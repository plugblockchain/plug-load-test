
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

  async function getFinalizedBlockNumber(api) {
    const hash = await api.rpc.chain.getFinalizedHead();
    const header = await api.rpc.chain.getHeader(hash);
    return header.number;
  }

module.exports = {
    sleep,
    getFinalizedBlockNumber,
}