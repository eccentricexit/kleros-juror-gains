#!/usr/bin/env node
'use strict';


// This tool builds a csv of all your payments and penalties your accounts received.
import { ethers } from 'ethers';
import { ArgumentParser, RawDescriptionHelpFormatter, RawTextHelpFormatter } from 'argparse';

import { version } from './package.json';
import klerosABI from './kleros-abi.json'


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
const klerosLiquid = new ethers.Contract(KLEROS_ADDRESS, klerosABI, provider)

// We do things synchronously and add delays to avoid hitting rate limits.
;(async () => {
  for (const jurorAddress of jurorAddresses) {
    // Pull data
    console.info(jurorAddress)
  }
})()