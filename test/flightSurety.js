const web3Utils = require("web3-utils");

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
    await config.flightSuretyData.authorizeContract(config.testAddresses[6]); // fifithAirline
    await config.flightSuretyData.authorizeContract(config.testAddresses[7]); // client
  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  it(`(multiparty) has correct initial isOperational() value`, async function () {
    // Get operating status
    let status = await config.flightSuretyData.isOperational.call();

    assert.equal(status, true, "Incorrect initial operating status value");
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

  it("(data - operation) CANNOT see isOperational from data", async function () {
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
      airlineVotes[1].toLowerCase(),
      config.testAddresses[5].toLowerCase(),
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

  it("(app - flight) CAN register flight", async () => {
    let newFlightNumber = web3Utils.utf8ToHex("LFT568");
    let newFlightTime = 0800;
    let fifthAirline = config.testAddresses[6];

    await config.flightSuretyApp.registerFlight(
      newFlightNumber,
      newFlightTime,
      { from: fifthAirline }
    );

    let newFlight = await config.flightSuretyData.getFlight.call(
      newFlightNumber,
      { from: fifthAirline }
    );
    let flightsRegistered = await config.flightSuretyData.getFlightsRegistered({
      from: config.firstAirline,
    });

    // assert.equal(
    //   web3Utils.hexToUtf8(newFlight[0]),
    //   "LFT568",
    //   "wrong flight number"
    // );
    assert.equal(newFlight[0], true, "wrong flight isRegistered");
    assert.equal(Number(newFlight[1]), 0, "wrong flight statusCode");
    assert.equal(Number(newFlight[2]), 0800, "wrong flight updatedTimestamp");
    assert.equal(
      newFlight[3].toLowerCase(),
      fifthAirline.toLowerCase(),
      "wrong flight airline address"
    );
    assert.equal(
      flightsRegistered.length,
      1,
      "wrong number of flights registered"
    );
    assert.equal(
      flightsRegistered[0],
      newFlight[4],
      "wrong flight key registered"
    );
  });

  it("(app - flight) CANNOT register flight if already registered", async () => {
    let newFlightNumber = web3Utils.utf8ToHex("LFT568");
    let newFlightTime = 0800;
    let fifthAirline = config.testAddresses[6];

    let reverted = false;

    try {
      await config.flightSuretyApp.registerFlight(
        newFlightNumber,
        newFlightTime,
        { from: fifthAirline }
      );
    } catch (e) {
      reverted = true;
    }

    let newFlight = await config.flightSuretyData.getFlight.call(
      newFlightNumber,
      { from: fifthAirline }
    );
    let flightsRegistered = await config.flightSuretyData.getFlightsRegistered({
      from: config.firstAirline,
    });

    assert.equal(reverted, true, "could register flight if already registered");
    assert.equal(
      flightsRegistered.length,
      1,
      "wrong number of flights registered"
    );
    assert.equal(
      flightsRegistered[0],
      newFlight[4],
      "wrong flight key registered"
    );
  });

  it("(app - insurance) CAN buy insurance for a flight", async () => {
    let flightNumber = web3Utils.utf8ToHex("LFT568");
    let client = config.testAddresses[7];
    let fifthAirline = config.testAddresses[6];

    await config.flightSuretyApp.buyInsurance(flightNumber, {
      from: client,
      value: config.weiMultiple * 1,
    });

    let flight = await config.flightSuretyData.getFlight.call(flightNumber, {
      from: fifthAirline,
    });
    let flightInsurances = await config.flightSuretyData.getFlightInsurances(
      flight[4],
      { from: fifthAirline }
    );
    let newInsurance = await config.flightSuretyData.getInsurance.call(
      flightInsurances[0],
      { from: fifthAirline }
    );
    let balance = await web3.eth.getBalance(config.flightSuretyData.address);

    assert.equal(
      newInsurance[0].toLowerCase(),
      client.toLowerCase(),
      "wrong insurance client"
    );
    assert.equal(
      Number(newInsurance[1]),
      config.weiMultiple * 1,
      "wrong insurance value"
    );
    assert.equal(newInsurance[2], false, "wrong insurance isPayed");
    assert.equal(Number(newInsurance[3]), 0, "wrong insurance balance");
    assert.equal(
      balance,
      config.weiMultiple * 11,
      "wrong contract total balance"
    );
    assert.equal(
      flightInsurances.length,
      1,
      "wrong number of flight insurances registered"
    );
  });

  it("(app - insurance) CANNOT buy insurance for an unregistered flight", async () => {
    let flightNumber = web3Utils.utf8ToHex("LFT523");
    let registeredFlightNumber = web3Utils.utf8ToHex("LFT568");
    let client = config.testAddresses[7];
    let fifthAirline = config.testAddresses[6];

    let reverted = false;

    try {
      await config.flightSuretyApp.buyInsurance(flightNumber, {
        from: client,
        value: config.weiMultiple * 1,
      });
    } catch (e) {
      reverted = true;
    }

    let flight = await config.flightSuretyData.getFlight.call(
      registeredFlightNumber,
      {
        from: fifthAirline,
      }
    );
    let flightInsurances = await config.flightSuretyData.getFlightInsurances(
      flight[4],
      { from: fifthAirline }
    );
    let balance = await web3.eth.getBalance(config.flightSuretyData.address);

    assert.equal(
      reverted,
      true,
      "could buy insurance for an unregistered flight"
    );
    assert.equal(
      balance,
      config.weiMultiple * 11,
      "wrong contract total balance"
    );
    assert.equal(
      flightInsurances.length,
      1,
      "wrong number of flight insurances registered"
    );
  });

  it("(app - insurance) CANNOT buy insurance if client already insured", async () => {
    let registeredFlightNumber = web3Utils.utf8ToHex("LFT568");
    let insuredClient = config.testAddresses[7];
    let fifthAirline = config.testAddresses[6];

    let reverted = false;

    try {
      await config.flightSuretyApp.buyInsurance(registeredFlightNumber, {
        from: insuredClient,
        value: config.weiMultiple * 1,
      });
    } catch (e) {
      reverted = true;
    }

    let flight = await config.flightSuretyData.getFlight.call(
      registeredFlightNumber,
      {
        from: fifthAirline,
      }
    );
    let flightInsurances = await config.flightSuretyData.getFlightInsurances(
      flight[4],
      { from: fifthAirline }
    );
    let balance = await web3.eth.getBalance(config.flightSuretyData.address);

    assert.equal(
      reverted,
      true,
      "could buy insurance if client already insured"
    );
    assert.equal(
      balance,
      config.weiMultiple * 11,
      "wrong contract total balance"
    );
    assert.equal(
      flightInsurances.length,
      1,
      "wrong number of flight insurances registered"
    );
  });

  it("(app - insurance) CANNOT buy insurance with more than maximum value allowed", async () => {
    let registeredFlightNumber = web3Utils.utf8ToHex("LFT568");
    let insuredClient = config.testAddresses[7];
    let fifthAirline = config.testAddresses[6];

    let reverted = false;

    try {
      await config.flightSuretyApp.buyInsurance(registeredFlightNumber, {
        from: insuredClient,
        value: config.weiMultiple * 3,
      });
    } catch (e) {
      reverted = true;
    }

    let flight = await config.flightSuretyData.getFlight.call(
      registeredFlightNumber,
      {
        from: fifthAirline,
      }
    );
    let flightInsurances = await config.flightSuretyData.getFlightInsurances(
      flight[4],
      { from: fifthAirline }
    );
    let balance = await web3.eth.getBalance(config.flightSuretyData.address);

    // console.log(flight);
    // console.log(flightInsurances);
    // console.log(balance);

    assert.equal(
      reverted,
      true,
      "could buy insurance with more than maximum value allowed"
    );
    assert.equal(
      balance,
      config.weiMultiple * 11,
      "wrong contract total balance"
    );
    assert.equal(
      flightInsurances.length,
      1,
      "wrong number of flight insurances registered"
    );
  });

  it("(app - insurance) CAN buy insurance for a flight to another client", async () => {
    let registeredFlightNumber = web3Utils.utf8ToHex("LFT568");
    let newClient = config.testAddresses[8];
    let fifthAirline = config.testAddresses[6];

    await config.flightSuretyApp.buyInsurance(registeredFlightNumber, {
      from: newClient,
      value: config.weiMultiple * 1,
    });

    let flight = await config.flightSuretyData.getFlight.call(
      registeredFlightNumber,
      {
        from: fifthAirline,
      }
    );
    let flightInsurances = await config.flightSuretyData.getFlightInsurances(
      flight[4],
      { from: fifthAirline }
    );
    let newInsurance = await config.flightSuretyData.getInsurance.call(
      flightInsurances[1],
      { from: fifthAirline }
    );
    let balance = await web3.eth.getBalance(config.flightSuretyData.address);

    assert.equal(
      newInsurance[0].toLowerCase(),
      newClient.toLowerCase(),
      "wrong insurance client"
    );
    assert.equal(
      Number(newInsurance[1]),
      config.weiMultiple * 1,
      "wrong insurance value"
    );
    assert.equal(newInsurance[2], false, "wrong insurance isPayed");
    assert.equal(Number(newInsurance[3]), 0, "wrong insurance balance");
    assert.equal(
      balance,
      config.weiMultiple * 12,
      "wrong contract total balance"
    );
    assert.equal(
      flightInsurances.length,
      2,
      "wrong number of flight insurances registered"
    );
  });
});
