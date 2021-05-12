// This tool builds a csv of all your payments and penalties your accounts received.
import { ethers } from 'ethers';
import { ArgumentParser } from 'argparse';
import fs from 'fs'
import R from 'ramda'
import json2csv from 'json2csv'
import fetch from 'node-fetch';

import { version } from './package.json';
import klerosABI from './kleros-abi.json'

function toCSV(records, fileName) {
  if (!records.length) throw 'Error - Array is empty';

  const fields = {data: records, fields: R.keys(records[0])};

  return new Promise<void>(function(resolve, reject) {
    json2csv(fields, function(err, csv) {
      if (err) reject(err);
      fs.writeFile(fileName, csv, function(err) {
        return !err ? resolve() : reject(err);
      });
    });
  });
};


const parser = new ArgumentParser({
  description: 'Kleros Juror Tax Reporting',
  add_help: true,
});

parser.add_argument('-v', '--version', { action: 'version', version });
parser.add_argument('-e', '--etherscan', { help: 'Etherscan api key' });
parser.add_argument('-a', '--addresses', { help: 'Path to JSON array of the addresses you used as a juror' });

const { etherscan: etherscanKey, addresses: jurorAddressesPath } = parser.parse_args();
if (!etherscanKey) {
  console.error('Missing etherscan key. Use -h to learn more.')
  process.exit(1)
}

if (!jurorAddressesPath) {
  console.error('Missing juror addresses path. Use -h to learn more.')
  process.exit(1)
}

const jurorAddresses = require(jurorAddressesPath);
const provider = ethers.providers.getDefaultProvider('mainnet', {
  etherscan: etherscanKey
})
const KLEROS_ADDRESS = '0x988b3A538b618C7A603e1c11Ab82Cd16dbE28069'
const PNK_ADDRESS= '0x93ed3fbe21207ec2e8f2d3c3de6e058cb73bc04d'

const klerosLiquid = new ethers.Contract(KLEROS_ADDRESS, klerosABI, provider)

// We do things synchronously and add delays to avoid hitting rate limits.
;(async () => {
  for (const jurorAddress of jurorAddresses) {
    console.info('Fetching events...')
    const tokenAndEthShiftEvents = (await provider.getLogs({
      ...klerosLiquid.filters.TokenAndETHShift(jurorAddress),
      fromBlock: 7303699,
      toBlock: 'latest'
    }))
    console.info('Fetching prices...')

    const results = [];
    for (const tokenAndEthShiftEvent of tokenAndEthShiftEvents) {
      const { timestamp } = await provider.getBlock(tokenAndEthShiftEvent.blockNumber)
      const date = new Date(timestamp * 1000)
      const dateString = `${date.getDate()}-${date.getMonth()}-${date.getFullYear()}`

      const BASIS_POINTS = 10000
      const pnkPriceUsdAtTheTime = ethers.utils.parseUnits(String((await (await fetch(`https://api.coingecko.com/api/v3/coins/kleros/history?date=${dateString}`)).json()).market_data.current_price.usd*BASIS_POINTS), 2)
      const etherPriceUsdAtTheTime = ethers.utils.parseUnits(String((await (await fetch(`https://api.coingecko.com/api/v3/coins/ethereum/history?date=${dateString}`)).json()).market_data.current_price.usd*BASIS_POINTS), 2)

      const parsedEvent = klerosLiquid.interface.parseLog(tokenAndEthShiftEvent)

      // Note that this value can be negative if the juror was punished.
      const pnkGain = parsedEvent.args._tokenAmount as ethers.BigNumber;
      const pnkGainInUsd = pnkGain.mul(pnkPriceUsdAtTheTime)

      const ethGain = parsedEvent.args._ETHAmount as ethers.BigNumber;
      const ethGainInUsd = ethGain.mul(etherPriceUsdAtTheTime)

      results.push({
        'Amount': ethers.utils.formatUnits(pnkGain, 18),
        'Currency': 'PNK',
        'Value in USD at the time': ethers.utils.formatUnits(pnkGainInUsd.div(ethers.BigNumber.from(BASIS_POINTS)), 18),
        'Date': dateString,
        'Tx Hash': tokenAndEthShiftEvent.transactionHash
      })
      results.push({
        'Amount': ethers.utils.formatUnits(ethGain, 18),
        'Currency': 'ETH',
        'Value in USD at the time': ethers.utils.formatUnits(ethGainInUsd.div(ethers.BigNumber.from(BASIS_POINTS)), 18),
        'Date': dateString,
        'Tx Hash': tokenAndEthShiftEvent.transactionHash
      })
    }

    console.info('Building csv...')
    toCSV(results, 'output.csv');
  }
})()
