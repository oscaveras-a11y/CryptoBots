"""Read-only local research memory summary."""
import argparse
import json
from pathlib import Path
from trader.market_memory import MarketMemory


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--memory",default="data/market-memory.sqlite3")
    parser.add_argument("--limit",type=int,default=30)
    args=parser.parse_args()
    if not Path(args.memory).exists():
        parser.error("No memory database yet; run autonomous paper bot first")
    memory=MarketMemory(args.memory)
    try:
        print(json.dumps(memory.summary(args.limit),ensure_ascii=False,indent=2))
    finally:
        memory.close()


if __name__=="__main__":
    main()
