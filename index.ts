// This tool builds a csv of all your payments and penalties your accounts received.
import { ethers } from "ethers";
import { ArgumentParser } from "argparse";

import fetch from "node-fetch";
import json2csv from "json-to-csv";

import { version } from "./package.json";
import klerosABI from "./kleros-abi.json";

const parser = new ArgumentParser({
  description: "Kleros Juror Tax Reporting",
  add_help: true,
});

parser.add_argument("-v", "--version", { action: "version", version });
parser.add_argument("-e", "--etherscan", { help: "Etherscan api key" });
parser.add_argument("-c", "--cryptocompare", { help: "Cryptocompare api key" });
parser.add_argument("-a", "--addresses", {
  help: "Path to JSON array of the addresses you used as a juror",
});

const { etherscan: etherscanKey, addresses: jurorAddressesPath, cryptocompare: cryptocompareKey } = parser.parse_args();
if (!etherscanKey) {
  console.error("Missing etherscan key. Use -h to learn more.");
  process.exit(1);
}

if (!jurorAddressesPath) {
  console.error("Missing juror addresses path. Use -h to learn more.");
  process.exit(1);
}

if (!cryptocompareKey) {
  console.error("Missing cryptocompare key. Use -h to learn more.");
  process.exit(1);
}

const jurorAddresses = require(jurorAddressesPath);
const provider = ethers.providers.getDefaultProvider("mainnet", {
  etherscan: etherscanKey,
});
const KLEROS_ADDRESS = "0x988b3A538b618C7A603e1c11Ab82Cd16dbE28069";

const klerosLiquid = new ethers.Contract(KLEROS_ADDRESS, klerosABI, provider);

// We do things synchronously and add delays to avoid hitting rate limits.
(async () => {
  console.info(`Got ${jurorAddresses.length} addresses`);
  let i = 1;
  const results = [];
  for (const jurorAddress of jurorAddresses) {
    console.info(` ${i} of ${jurorAddresses.length} addresses`);
    i++;

    const tokenAndEthShiftEvents = await provider.getLogs({
      ...klerosLiquid.filters.TokenAndETHShift(jurorAddress),
      fromBlock: 7303699,
      toBlock: "latest",
    });

    console.info(`Got ${tokenAndEthShiftEvents.length} token and ETH transfers.`);
    let j = 1;
    for (const tokenAndEthShiftEvent of tokenAndEthShiftEvents) {
      console.info(`  ${j} of ${tokenAndEthShiftEvents.length}`);
      j++;
      const { timestamp } = await provider.getBlock(tokenAndEthShiftEvent.blockNumber);
      const date = new Date(timestamp * 1000);
      const dateString = `${date.getDate()}-${date.getMonth()}-${date.getFullYear()}`;

      const PRECISION = 1000000;
      const pnkPriceUsdAtTheTimeNum = (
        await (
          await fetch(
            `https://min-api.cryptocompare.com/data/v2/histoday?fsym=PNK&tsym=USD&limit=1&aggregate=1&toTs=${timestamp}&extraParams=visus_tax&api_key=${cryptocompareKey}`,
          )
        ).json()
      ).Data.Data[0].close * PRECISION;

      const pnkPriceUsdAtTheTime = ethers.BigNumber.from(
        String(pnkPriceUsdAtTheTimeNum.toFixed(0)),
      );

      const ethPriceUsdAtTheTimeNum = (
        await (
          await fetch(
            `https://min-api.cryptocompare.com/data/v2/histoday?fsym=ETH&tsym=USD&limit=1&aggregate=1&toTs=${timestamp}&extraParams=visus_tax&api_key=${cryptocompareKey}`,
          )
        ).json()
      ).Data.Data[0].close * PRECISION;
      const ethPriceUsdAtTheTime = ethers.BigNumber.from(
        String(ethPriceUsdAtTheTimeNum.toFixed(0)),
      );

      const parsedEvent = klerosLiquid.interface.parseLog(tokenAndEthShiftEvent);

      // Note that this value can be negative if the juror was punished.
      const pnkGain = parsedEvent.args._tokenAmount as ethers.BigNumber;
      const pnkGainInUsd = pnkGain.mul(pnkPriceUsdAtTheTime);

      const ethGain = parsedEvent.args._ETHAmount as ethers.BigNumber;
      const ethGainInUsd = ethGain.mul(ethPriceUsdAtTheTime);

      results.push({
        Amount: ethers.utils.formatUnits(pnkGain, 18),
        Currency: "PNK",
        "Value in USD at the time": Number(ethers.utils.formatUnits(pnkGainInUsd, 18)) / PRECISION,
        Date: dateString,
        "Tx Hash": tokenAndEthShiftEvent.transactionHash,
      });
      results.push({
        Amount: ethers.utils.formatUnits(ethGain, 18),
        Currency: "ETH",
        "Value in USD at the time": Number(ethers.utils.formatUnits(ethGainInUsd, 18)) / PRECISION,
        Date: dateString,
        "Tx Hash": tokenAndEthShiftEvent.transactionHash,
      });
    }
  }

  console.info("Building csv...");
  await json2csv(results, "output.csv");
  console.info("Done writing to CSV");
})();
