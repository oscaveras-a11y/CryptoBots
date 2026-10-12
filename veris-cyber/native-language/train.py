"""CPU-only proof-of-training for JARVIS MoE. Train only on user-supplied licensed text."""
import argparse
from pathlib import Path
import torch
from torch.nn import functional as F
from moe import Config, JarvisMoE, parameter_count

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--corpus",required=True,help="UTF-8 text with appropriate training rights")
    parser.add_argument("--output",default="jarvis-moe-prototype.pt")
    parser.add_argument("--steps",type=int,default=30)
    parser.add_argument("--seed",type=int,default=42)
    parser.add_argument("--resume",action="store_true")
    args=parser.parse_args()
    if not 1<=args.steps<=5000:
        parser.error("steps must be between 1 and 5000")
    raw=Path(args.corpus).read_bytes()
    if len(raw)<512 or len(raw)>20_000_000:
        parser.error("corpus must contain 512 to 20,000,000 bytes")
    torch.manual_seed(args.seed)
    torch.set_num_threads(min(4,torch.get_num_threads()))
    cfg=Config()
    model=JarvisMoE(cfg)
    optimizer=torch.optim.AdamW(model.parameters(),lr=0.0003)
    completed=0
    target=Path(args.output)
    if args.resume:
        if not target.is_file():
            parser.error("checkpoint not found")
        checkpoint=torch.load(target,map_location="cpu",weights_only=True)
        if checkpoint.get("config")!=vars(cfg):
            parser.error("checkpoint configuration mismatch")
        model.load_state_dict(checkpoint["state_dict"])
        optimizer.load_state_dict(checkpoint["optimizer"])
        completed=int(checkpoint["steps"])
        if completed<0 or completed>1000000:
            parser.error("invalid checkpoint step")
    elif target.exists():
        parser.error("output already exists; choose another path")
    def save_checkpoint(steps):
        target.parent.mkdir(parents=True,exist_ok=True)
        temp=target.with_suffix(".tmp")
        torch.save({"config":vars(cfg),"state_dict":model.state_dict(),"optimizer":optimizer.state_dict(),
                    "steps":steps,"tokenizer":"utf8_bytes_v0","training":"experimental_cpu"},temp)
        temp.replace(target)
    data=torch.tensor(list(raw),dtype=torch.long)
    for step in range(args.steps):
        start=int(torch.randint(0,len(data)-cfg.context-1,(1,)).item())
        window=data[start:start+cfg.context+1].unsqueeze(0)
        logits,balance=model(window[:,:-1])
        loss=F.cross_entropy(logits.reshape(-1,cfg.vocab_size),window[:,1:].reshape(-1))+0.01*balance
        optimizer.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(),1.0)
        optimizer.step()
        if step==0 or (step+1)%10==0:
            print(f"step={completed+step+1} loss={loss.item():.4f} parameters={parameter_count(model)}",flush=True)
        if (step+1)%10==0:
            save_checkpoint(completed+step+1)
    save_checkpoint(completed+args.steps)
    print(f"prototype_saved={target}")

if __name__=="__main__":
    main()
