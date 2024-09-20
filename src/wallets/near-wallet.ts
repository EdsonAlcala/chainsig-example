
// near api js
import { providers } from 'near-api-js';

// wallet selector
import { distinctUntilChanged, map } from 'rxjs';
import '@near-wallet-selector/modal-ui/styles.css';
import { setupModal } from '@near-wallet-selector/modal-ui';
import { setupWalletSelector } from '@near-wallet-selector/core';
import { setupHereWallet } from '@near-wallet-selector/here-wallet';
import { setupMyNearWallet } from '@near-wallet-selector/my-near-wallet';
import { setupOKXWallet } from "@near-wallet-selector/okx-wallet";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";

const THIRTY_TGAS = '30000000000000';
const NO_DEPOSIT = '0';

export class Wallet {
  /**
   * @constructor
   * @param {string} networkId - the network id to connect to
   * @param {string} createAccessKeyFor - the contract to create an access key for
   * @example
   * const wallet = new Wallet({ networkId: 'testnet', createAccessKeyFor: 'contractId' });
   * wallet.startUp((signedAccountId) => console.log(signedAccountId));
   */
  constructor({ networkId = 'testnet', createAccessKeyFor = undefined }) {
    // @ts-ignore
    this.createAccessKeyFor = createAccessKeyFor;
    // @ts-ignore
    this.networkId = networkId;
  }

  /**
   * To be called when the website loads
   * @param {Function} accountChangeHook - a function that is called when the user signs in or out#
   * @returns {Promise<string>} - the accountId of the signed-in user 
   */
  startUp = async (accountChangeHook) => {
    // @ts-ignore
    this.selector = setupWalletSelector({
      // @ts-ignore
      network: this.networkId,
      modules: [
        setupMyNearWallet(),
        setupHereWallet(),
        setupOKXWallet(),
        setupMeteorWallet()
      ]
    });

    // @ts-ignore
    const walletSelector = await this.selector;
    const isSignedIn = walletSelector.isSignedIn();
    const accountId = isSignedIn ? walletSelector.store.getState().accounts[0].accountId : '';

    walletSelector.store.observable
      .pipe(
        // @ts-ignore
        map(state => state.accounts),
        distinctUntilChanged()
      )
      .subscribe(accounts => {
        const signedAccount = accounts.find((account) => account.active)?.accountId;
        accountChangeHook(signedAccount);
      });

    return accountId;
  };

  /**
   * Displays a modal to login the user
   */
  signIn = async () => {
    // @ts-ignore
    const modal = setupModal(await this.selector, { contractId: this.createAccessKeyFor });
    modal.show();
  };

  /**
   * Logout the user
   */
  signOut = async () => {
    // @ts-ignore
    const selectedWallet = await (await this.selector).wallet();
    selectedWallet.signOut();
  };

  /**
   * Makes a read-only call to a contract
   * @param {string} contractId - the contract's account id
   * @param {string} method - the method to call
   * @param {Object} args - the arguments to pass to the method
   * @returns {Promise<JSON.value>} - the result of the method call
   */
  viewMethod = async ({ contractId, method, args = {} }) => {
    // @ts-ignore
    const walletSelector = await this.selector;
    const { network } = walletSelector.options;
    const provider = new providers.JsonRpcProvider({ url: network.nodeUrl });

    let res = await provider.query({
      request_type: 'call_function',
      account_id: contractId,
      method_name: method,
      args_base64: Buffer.from(JSON.stringify(args)).toString('base64'),
      finality: 'optimistic',
    });
    // @ts-ignore
    return JSON.parse(Buffer.from(res.result).toString());
  };


  /**
   * Makes a call to a contract
   * @param {string} contractId - the contract's account id
   * @param {string} method - the method to call
   * @param {Object} args - the arguments to pass to the method
   * @param {string} gas - the amount of gas to use
   * @param {string} deposit - the amount of yoctoNEAR to deposit
   * @returns {Promise<Transaction>} - the resulting transaction
   */
  callMethod = async ({ contractId, method, args = {}, gas = THIRTY_TGAS, deposit = NO_DEPOSIT }) => {
    // Sign a transaction with the "FunctionCall" action
    // @ts-ignore
    const select = await this.selector
    // @ts-ignore
    const selectedWallet = await select.wallet();

    if (!selectedWallet) {
      console.error('No wallet selected or wallet initialization failed');
      return;
    }

    let outcome
    if (selectedWallet.id === 'okx-wallet') {
      try {
        // @ts-ignore
        const response = await window.okxwallet.near.signAndSendTransaction({
          receiverId: contractId,
          actions: [
            {
                methodName: method,
                args,
                gas,
                deposit,
            },
          ],
        })
        const sig = await this.getTransactionResult(response.txHash)
        return sig
      } catch(e) {
        console.log('e', e)
      }
    } else {
      try {
        outcome = await selectedWallet.signAndSendTransaction({
          receiverId: contractId,
          actions: [
            {
              type: 'FunctionCall',
              params: {
                methodName: method,
                args,
                gas,
                deposit,
              },
            },
          ],
        });    
      } catch (e) {
        console.log('e', e)
      }  
    }

    return providers.getTransactionLastResult(outcome);
  };

  /**
   * Makes a call to a contract
   * @param {string} txhash - the transaction hash
   * @returns {Promise<JSON.value>} - the result of the transaction
   */
  getTransactionResult = async (txhash) => {
    // @ts-ignore
    const walletSelector = await this.selector;
    const { network } = walletSelector.options;
    const provider = new providers.JsonRpcProvider({ url: network.nodeUrl });

    // Retrieve transaction result from the network
    const transaction = await provider.txStatus(txhash, 'unnused');
    return providers.getTransactionLastResult(transaction);
  };
}