function KeypairSelector(keypairs) {
  this.keypairs = keypairs;
  this.index = 0;

  this.next = function() {
    if (this.keypairs.length <= 1) {
      return [null, null];
    }

    let items = this.keypairs.slice(0);
    const sender = items[0];//.splice(this.index,1)[0];
    const receiver = items.splice(this.index,1)[0];
    //const receiver = items[Math.floor(Math.random() * items.length)];

    this.index ++;
    if (this.index >= this.keypairs.length) {
      this.index = 0;
    }
    return [sender, receiver];
  }

}



if (require.main === module) {
  console.log("Not executable")
} else {
  // Export modules for testing
  module.exports = {
    KeypairSelector: KeypairSelector
  }
}