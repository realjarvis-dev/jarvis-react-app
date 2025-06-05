export async function GET(request: Request) {
  try {
    const response = await fetch('http://anvil-fork:8545', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return new Response(
        `Error from anvil-fork: ${response.status} ${errorText}`,
        { status: response.status }
      )
    }

    const data = await response.json()
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error('Error making request to anvil-fork:', error)
    if (error instanceof Error) {
      return new Response(`Internal Server Error: ${error.message}`, {
        status: 500
      })
    }
    return new Response('Internal Server Error', { status: 500 })
  }
}
