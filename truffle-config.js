var HDWalletProvider = require("truffle-hdwallet-provider");
var mnemonic = "";

module.exports = {
  networks: {
    development: {
      // provider: function () {
      //   return new HDWalletProvider(mnemonic, "http://127.0.0.1:8545/", 0, 50);
      // },
      host: "127.0.0.1", // Localhost (default: none)
      port: 8545, // Standard Ethereum port (default: none)
      network_id: "*",
      gas: 6713094,
      gasLimit: 3141592000000, // Any network (default: none)
    },
  },
  compilers: {
    solc: {
      version: "^0.4.24",
    },
  },
};
