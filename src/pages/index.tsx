import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import React from 'react'

const HomePage: NextPage = () => {
  const router = useRouter()
  React.useEffect(() => {
    router.replace('/dashboard')
  }, [router])
  return <></>
}

export default HomePage
