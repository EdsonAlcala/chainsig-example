import React from 'react';
import { useStore } from "../layout";
import { generateAddress } from '../helpers/kdf'
import bitcoin from '../helpers/bitcoin'
import { useState, useEffect } from 'react'
import { useForm } from "react-hook-form"
import Spin from '../components/Spin'
import Image from 'next/image'
import Success from '../components/Success'
import Router from "next/router";
import { useRouter } from 'next/router'

const MPC_PUBLIC_KEY = process.env.MPC_PUBLIC_KEY

export default function Home() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm()
  const { signedAccountId, wallet } = useStore();
  const [balance, setBalance] = useState('')
  const [address, setAddress] = useState('')
  const [progress, setProgress] = useState(false)
  const [error, setError] = useState('')
  const [path, setPath] = useState('bitcoin,1')
  const [hash, setHash] = useState('')
  const router = useRouter()

  // useEffect(() => {
    if (typeof window !== 'undefined') {
      if (router.query && router.query.transactionHashes) {
        const hash = router.query.transactionHashes
        const broadcastTx = async () => {
          const storageTo = localStorage.getItem('data_to');
          const storageAmount = localStorage.getItem('data_amount');
          const storagePath = localStorage.getItem('data_path');
  
          if (!storageTo || !storageAmount || !storagePath) return
  
          const sig = await wallet.getTransactionResult(hash)

          // @ts-ignore
          const struct = await generateAddress({
            publicKey: MPC_PUBLIC_KEY,
            accountId: signedAccountId,
            path: path,
            chain: 'bitcoin'
          })
  
          const btcAddress = struct.address
          const btcPublicKey = struct.publicKey
  
          await bitcoin.broadcast({
            from: btcAddress,
            publicKey: btcPublicKey,
            to: storageTo,
            amount: storageAmount,
            path: storagePath,
            sig
          })

          // localStorage.removeItem('data_to');
          // localStorage.removeItem('data_amount');
          // localStorage.removeItem('data_path');
        }
        broadcastTx()
      }
    }  
  // }, [])

  const getAddress = async () => {
    const struct = await generateAddress({
      publicKey: MPC_PUBLIC_KEY,
      accountId: signedAccountId,
      path: path,
      chain: 'bitcoin'
    })
    setAddress(struct.address)
    return [struct.address, struct.publicKey]
  }

  const onSubmit = async (data) => {
    setProgress(true)

    // Save form state to localStorage
    localStorage.setItem('data_to', data.to);
    localStorage.setItem('data_amount', data.amount);
    localStorage.setItem('data_path', data.path);

    const struct = await generateAddress({
      publicKey: MPC_PUBLIC_KEY,
      accountId: signedAccountId,
      path: data.path,
      chain: 'bitcoin'
    })
    const btcAddress = struct.address
    const btcPublicKey = struct.publicKey

    const response: string | void | Response = await bitcoin.send({
      from: btcAddress,
      publicKey: btcPublicKey,
      to: data.to,
      amount: data.amount,
      path: data.path,
    })

    if (typeof response === 'string') {
      setHash(String(response))
    } else if (response) {
      const text = await response.text()
      const jsonText = JSON.parse(text.split("error:")[1])
      setError(jsonText.message)
    }
    setProgress(false)
  }

  useEffect(() => {
    getAddress()
  }, [signedAccountId, path, balance, error, hash])

  const checkBal = async () => {
    const response = await bitcoin.getBalance({
      address: address,
    })
    if (response) {
      setBalance(response)  
    } else {
      setBalance('0')
    }
  }

  const resetForm = () => Router.reload()

  return (
    <main className={'w-[100vw] h-[100vh] flex justify-center items-center'}>
      {hash ? 
          <div className={"flex border justify-center items-center min-w-[30em] max-w-[30em] w-[50vw] min-h-[24em] max-h-[30em] h-[50vh] bg-white rounded-xl shadow-xl p-4"} style={{ display: 'flex', flexDirection: 'column' }}>
            <Success />
            <a target="_blank" href={`https://blockstream.info/testnet/tx/${hash}`} className="w-full text-center mt-4 hover:opacity-50 cursor-pointer">{`explorer link: https://blockstream.info/testnet/tx/${hash}`}</a> 
            <button onClick={() => resetForm()} className={'mt-4 bg-blue-500 hover:bg-blue-700 text-white py-2 px-4 rounded-md border w-48 mb-2 cursor-pointer'}>OK</button>
          </div>
        : error ? 
          <div className={"flex border justify-center items-center min-w-[30em] max-w-[30em] w-[50vw] min-h-[24em] max-h-[30em] h-[50vh] bg-white rounded-xl shadow-xl p-4"} style={{ display: 'flex', flexDirection: 'column' }}>
            <Image
              alt="Failure"
              src={'fail.svg'}
              width={200}
              height={200}
            />
            <p className="w-full text-center">{error}</p> 
            <button onClick={() => setError('')} className={'mt-4 bg-blue-500 hover:bg-blue-700 text-white py-2 px-4 rounded-md border w-48 mb-2 cursor-pointer'}>OK</button>
          </div>
        : progress ? 
          <div className={"flex border justify-center items-center min-w-[30em] max-w-[30em] w-[50vw] min-h-[24em] max-h-[30em] h-[50vh] bg-white rounded-xl shadow-xl p-4"} style={{ display: 'flex', flexDirection: 'column' }}>
            <Spin />
          </div>
        : <div className={"flex border justify-center min-w-[30em] max-w-[30em] w-[50vw] min-h-[26em] max-h-[24em] h-[50vh] bg-white rounded-xl shadow-xl p-4"} style={{ display: 'flex', flexDirection: 'column' }}>
          <p>{`Path:`}</p>
          <input className="border p-1 rounded bg-slate-700 text-white pl-4 w-1/3" defaultValue={'bitcoin,1'}  {...register("path")} onChange={(e) => setPath(e.target.value)} />

          <p>{`Address:`}</p>
          <input className="border p-1 rounded bg-slate-500 text-white pl-4" defaultValue={address} disabled />

          <p onClick={() => checkBal()}>{`Balance:`}</p>
          <div className="flex justify-center items-center">
            <input className="border p-1 rounded bg-slate-500 text-white pl-4 w-4/5 h-10 " defaultValue={balance} disabled />
            <button onClick={() => checkBal()} className={'bg-blue-500 hover:bg-blue-700 text-white py-2 px-4 rounded border w-1/5 cursor-pointer h-10'}>Check</button>
          </div>

          <div className="flex flex-col">
          <form className="flex flex-col mt-8" onSubmit={handleSubmit(onSubmit)}>
            <p>To Address:</p>
            <input className="border p-1 rounded bg-slate-700 text-white pl-4" placeholder="To Address" {...register("to")} />

            <p>Value:</p>
            <input className="border p-1 rounded bg-slate-700 text-white pl-4" placeholder="Value" {...register("amount", { required: true })} />

            {errors.exampleRequired && <span>This field is required</span>}

            <button className={'mt-4 bg-blue-500 hover:bg-blue-700 text-white py-2 px-4 rounded-md border w-48 mb-2 cursor-pointer'} type="submit">Send BTC</button>
          </form>
        </div>
      </div>}
    </main>
  );
}