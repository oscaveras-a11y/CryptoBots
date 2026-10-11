# JARVIS Native Language Engine — experimental MoE

This is an original **small sparse Transformer prototype**, not a trained 7B model. The 7B target is recorded in `seven_billion_blueprint()`; exact architecture, tokenizer, large-scale training, quantization, expert paging and integration into MIND are future work.

## Windows / 8 GB RAM — first training

Requires Python 3.10+ and a compatible PyTorch CPU build. From PowerShell:

```powershell
cd veris-cyber\native-language
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install torch --index-url https://download.pytorch.org/whl/cpu
.\.venv\Scripts\python.exe -m unittest test_moe.py
.\.venv\Scripts\python.exe train.py --corpus C:\dados\texto-autorizado.txt --steps 30 --output jarvis-moe-prototype.pt
```

Use a UTF-8 corpus that you own or have permission to train on (512 bytes–20 MB). Never commit personal data, corpus, or checkpoint files. Training starts only when you execute the command locally. A 30-step run verifies that gradients and checkpointing work; it **does not produce a useful chatbot**.

The byte-level prototype is deliberately small and CPU-friendly. A future production system needs a trained subword tokenizer, robust data pipeline, held-out evaluation, distributed training for 7B weights, quantized inference, measured SSD paging, and integration into the existing JARVIS MIND interface.

## Safety and resource expectations

On 8 GB RAM, close heavy programs before CPU training. The training CLI limits steps and corpus size and never downloads datasets or sends text to external services. The project does not automatically execute commands, write to other projects, or replace the current model.
