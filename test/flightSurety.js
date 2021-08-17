var Test = require("../config/testConfig.js");
var BigNumber = require("bignumber.js");

contract("Flight Surety Tests", async (accounts) => {
  var config;

  before("setup contract", async () => {
    config = await Test.Config(accounts);

    await config.flightSuretyData.authorizeContract(
      config.flightSuretyApp.address
    );
    await config.flightSuretyData.authorizeContract(config.firstAirline);
  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  it(`(multiparty) has correct initial isOperational() value`, async function () {
    // Get operating status
    let status = await config.flightSuretyData.isOperational.call();

    assert.equal(status, true, "Incorrect initial operating status value");
  });

  it("CANNOT see isOperational from data", async function () {
    let accessDenied = false;

    try {
      await config.flightSuretyData.isOperational.call({
        from: config.testAddresses[8],
      });
    } catch (e) {
      accessDenied = true;
    }

    assert.equal(accessDenied, true, "CAN see isOperational from data");
  });

  it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {
    // Ensure that access is denied for non-Contract Owner account
    let accessDenied = false;

    try {
      await config.flightSuretyData.setOperatingStatus(false, {
        from: config.testAddresses[2],
      });
    } catch (e) {
      accessDenied = true;
    }

    assert.equal(accessDenied, true, "Access not restricted to Contract Owner");
  });

  it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {
    // Ensure that access is allowed for Contract Owner account
    let accessDenied = false;

    try {
      await config.flightSuretyData.setOperatingStatus(false);
    } catch (e) {
      accessDenied = true;
    }

    assert.equal(
      accessDenied,
      false,
      "Access not restricted to Contract Owner"
    );
  });

  it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {
    await config.flightSuretyData.setOperatingStatus(false);

    let reverted = false;

    try {
      await config.flightSurety.setTestingMode(true);
    } catch (e) {
      reverted = true;
    }

    assert.equal(reverted, true, "Access not blocked for requireIsOperational");

    // Set it back for other tests to work
    await config.flightSuretyData.setOperatingStatus(true);
  });

  it("(airline) cannot register an Airline using registerAirline() if it is not funded", async () => {
    // ARRANGE
    let newAirline = config.testAddresses[2];
    let newAirlineName = "TAP";

    // ACT
    try {
      await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {
        from: config.firstAirline,
      });
    } catch (e) {}
    let result = await config.flightSuretyData.getAirline.call(newAirline, {
      from: config.firstAirline,
    });

    // ASSERT
    assert.equal(
      result[1],
      false,
      "Airline should not be able to register another airline if it hasn't provided funding"
    );
  });

  // it("(app - airline) CANNOT register airline if not contract owner", async () => {
  //   let newAirlineAddress = config.testAddresses[2];
  //   let newAirlineName = "TAP";
  //   let reverted = false;

  //   try {
  //     await config.flightSuretyApp.registerAirline(
  //       newAirlineAddress,
  //       newAirlineName,
  //       { from: newAirlineAddress }
  //     );
  //   } catch (e) {
  //     reverted = true;
  //   }

  //   assert.equal(
  //     reverted,
  //     true,
  //     "could register airline if not contract owner"
  //   );
  // });

  it("(app - airline) CANNOT register airline if not valid address", async () => {
    let newAirlineAddress = "0x0";
    let newAirlineName = "TAP";
    let reverted = false;

    try {
      await config.flightSuretyApp.registerAirline(
        newAirlineAddress,
        newAirlineName,
        { from: newAirlineAddress }
      );
    } catch (e) {
      reverted = true;
    }

    assert.equal(reverted, true, "could register airline if not valid address");
  });

  it("(app - airline) CANNOT register airline if not valid airline", async () => {
    let newAirlineAddress = config.testAddresses[2];
    let newAirlineName = "TAP";
    let reverted = false;

    try {
      await config.flightSuretyApp.registerAirline(
        newAirlineAddress,
        newAirlineName,
        { from: newAirlineAddress }
      );
    } catch (e) {
      reverted = true;
    }

    assert.equal(reverted, true, "could register airline if not valid airline");
  });

  it("(app - airline) CANNOT register airline if already registered", async () => {
    let newAirlineName = "TAP";
    let reverted = false;

    try {
      await config.flightSuretyApp.registerAirline(
        config.owner,
        newAirlineName,
        { from: config.firstAirline }
      );
    } catch (e) {
      reverted = true;
    }

    assert.equal(
      reverted,
      true,
      "could register airline if already registered"
    );
  });

  it("(app - airline) CAN register airline", async () => {
    let newAirlineAddress = config.testAddresses[3];
    let newAirlineName = "LATAM";

    await config.flightSuretyApp.registerAirline(
      newAirlineAddress,
      newAirlineName
    );
    let newAirline = await config.flightSuretyData.getAirline.call(
      newAirlineAddress,
      { from: config.firstAirline }
    );
    let airlinesRegistered =
      await config.flightSuretyData.getAirlinesRegistered({
        from: config.firstAirline,
      });

    assert.equal(newAirline[0], newAirlineName, "wrong airline name");
    assert.equal(newAirline[1], true, "wrong airline isRegistered");
    assert.equal(newAirline[2], false, "wrong airline isFunded");
    assert.equal(newAirline[3], 0, "wrong airline balance");

    assert.equal(airlinesRegistered, 2, "wrong number of airlines registered");
  });

  it("(app - airline) CANNOT vote in airline if already voted", async () => {
    await config.flightSuretyApp.registerAirline(
      config.testAddresses[4],
      "GOL"
    );
    await config.flightSuretyApp.registerAirline(
      config.testAddresses[5],
      "AZUL"
    );

    let newAirlineAddress = config.testAddresses[6];
    let newAirlineName = "LUFTHANSA";
    let reverted = false;

    try {
      await config.flightSuretyApp.registerAirline(
        newAirlineAddress,
        newAirlineName,
        { from: config.owner }
      );
      await config.flightSuretyApp.registerAirline(
        newAirlineAddress,
        newAirlineName,
        { from: config.owner }
      );
    } catch (e) {
      reverted = true;
    }

    let airlineVotes = await config.flightSuretyApp.getAirlineVotes(
      newAirlineAddress
    );
    let airlinesRegistered =
      await config.flightSuretyData.getAirlinesRegistered({
        from: config.firstAirline,
      });

    // let consensus = await config.flightSuretyApp.AIRLINE_CONSENSUS();
    // let consensusVotes = await config.flightSuretyApp.AIRLINE_CONSENSUS_VOTES();

    assert.equal(airlineVotes[0], config.owner, "wrong airline voter address");
    assert.equal(airlineVotes.length, 1, "wrong number of votes");
    assert.equal(airlinesRegistered, 4, "wrong number of airlines registered");
    assert.equal(reverted, true, "could vote in airline if already voted");
  });

  it("(app - airline) CAN register airline if consensus votes achieved", async () => {
    let newAirlineAddress = config.testAddresses[6];
    let newAirlineName = "LUFTHANSA";

    await config.flightSuretyApp.registerAirline(
      newAirlineAddress,
      newAirlineName,
      { from: config.testAddresses[5] }
    );

    let airlineVotes = await config.flightSuretyApp.getAirlineVotes(
      newAirlineAddress
    );
    let airlinesRegistered =
      await config.flightSuretyData.getAirlinesRegistered({
        from: config.firstAirline,
      });
    let newAirline = await config.flightSuretyData.getAirline.call(
      newAirlineAddress,
      { from: config.firstAirline }
    );

    assert.equal(airlineVotes[0], config.owner, "wrong airline voter address");
    assert.equal(
      airlineVotes[1],
      config.testAddresses[5],
      "wrong airline voter address"
    );
    assert.equal(airlineVotes.length, 2, "wrong number of votes");
    assert.equal(airlinesRegistered, 5, "wrong number of airlines registered");

    assert.equal(newAirline[0], newAirlineName, "wrong airline name");
    assert.equal(newAirline[1], true, "wrong airline isRegistered");
    assert.equal(newAirline[2], false, "wrong airline isFunded");
    assert.equal(newAirline[3], 0, "wrong airline balance");
  });

  it("(app - airline) CAN fund registered airline", async () => {
    let fifthAirline = config.testAddresses[6];

    await config.flightSuretyApp.fundAirline({
      from: fifthAirline,
      value: config.weiMultiple * 10,
    });

    let airline = await config.flightSuretyData.getAirline.call(fifthAirline, {
      from: config.firstAirline,
    });
    let balance = await web3.eth.getBalance(config.flightSuretyData.address);

    assert.equal(airline[2], true, "wrong airline isFunded");
    assert.equal(
      Number(airline[3]),
      config.weiMultiple * 10,
      "wrong airline balance"
    );
    assert.equal(
      balance,
      config.weiMultiple * 10,
      "wrong contract total balance"
    );
  });

  it("(app - airline) CANNOT fund registered airline with less than minimum fee", async () => {
    let fourthAirline = config.testAddresses[5];
    let reverted = false;

    try {
      await config.flightSuretyApp.fundAirline({
        from: fourthAirline,
        value: config.weiMultiple * 5,
      });
    } catch (e) {
      reverted = true;
    }

    let airline = await config.flightSuretyData.getAirline.call(fourthAirline, {
      from: config.firstAirline,
    });
    let balance = await web3.eth.getBalance(config.flightSuretyData.address);

    assert.equal(
      reverted,
      true,
      "could fund registered airline with less than minimum fee"
    );
    assert.equal(airline[2], false, "wrong airline isFunded");
    assert.equal(Number(airline[3]), 0, "wrong airline balance");
    assert.equal(
      balance,
      config.weiMultiple * 10,
      "wrong contract total balance"
    );
  });
});
