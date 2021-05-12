# Kleros Juror Tax

Decrease the pain of doing your taxes on juror gains with this tool.

It puts all of the events where you earned or lost PNK and all ETH earned into a csv, with date, tx hash and the total value in usd (value of the currency at the time).

## Steps to use:

0. You need etherscan and cryptocompare api keys for this. Free tier is fine;
1. `yarn` and `node` in the version specified inside `volta` in `package.json`;
2. Run `yarn` to install dependencies;
3. Make a JSON file with an array of the addresses you used as a juror;
4. Run`yarn start -e <etherscan-key> -a <path-to-json> -c <cryptocompare-key>`;
5. Go grab some coffee. The tool does everything very slowly on purpose to avoid getting rate limited.
6. Your file is in this folder: `output.csv`