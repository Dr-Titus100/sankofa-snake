"""Starts the game: python -m sankofa_snake [--seed N] [--fixed]"""

import argparse

from .app import run


def main():
    parser = argparse.ArgumentParser(prog="sankofa_snake", description="Sankofa Snake, the Pygame version.")
    parser.add_argument("--seed", type=int, help="a fixed seed, so the layouts and cowries are the same every run")
    parser.add_argument("--fixed", action="store_true", help="play every level exactly as its file draws it")
    args = parser.parse_args()
    run(seed=args.seed, fixed=args.fixed)


if __name__ == "__main__":
    main()
