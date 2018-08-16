App = {
  web3Provider: null,
  contracts: {},
  numOfBounties: 0,

  init: function () {



    return App.initWeb3();
  },

  initWeb3: function () {

    // Is there an injected web3 instance?
    if (typeof web3 !== 'undefined') {
      App.web3Provider = web3.currentProvider;
    } else {
      // If no injected web3 instance is detected, fall back to Ganache
      App.web3Provider = new Web3.providers.HttpProvider('http://localhost:7545');
    }
    web3 = new Web3(App.web3Provider);

    return App.initContract();
  },

  initContract: function () {

    $.getJSON('BirdBounty.json', function (data) {
      // Get the necessary contract artifact file and instantiate it with truffle-contract
      var BirdBountyArtifact = data;
      App.contracts.BirdBounty = TruffleContract(BirdBountyArtifact);

      // Set the provider for our contract
      App.contracts.BirdBounty.setProvider(App.web3Provider);

      // Use our contract to retrieve and mark the adopted pets
      return App.showBounties();
    });

    return App.bindEvents();
  },

  bindEvents: function () {

    $("#submit-oracle").click(App.oraclizeTweet);

    $("#submit-bird-bounty").click(App.submitBirdBounty);
    $("#create-bounty-jumbo").click(App.showCreateBountyInput);
    $("#fulfill-bounty-jumbo").click(App.showFulfillBountyInput);
    $("#fulfill-bountyid-input").change(App.checkBountyFulfill);
    $("#fulfill-bird-bounty").click(App.claimBounty);

  },

  showErrorMessage: function (message) {
    $("#message-output").text(message);
    $("#message-output").addClass('alert-danger').removeClass('alert-secondary');
    $("#message-output").show();
  },

  showNormalMessage: function (message) {
    $("#message-output").text(message);
    $("#message-output").removeClass('alert-danger').addClass('alert-secondary');
    $("#message-output").show();
  },

  getNumOfBounties: function () {
    var birdBountyInstance;

    return App.contracts.BirdBounty.deployed().then(function (instance) {
      birdBountyInstance = instance;
      return birdBountyInstance.getNumBounties()
    }).then(function (result) {
      console.log("Num of bounties: " + result);
      App.numOfBounties = result.toNumber();
      return App.numOfBounties;
    });
  },

  convertToBountyObject: function (bountyArray) {
    return {
      bountyIssuer: bountyArray[0],
      fulfillmentAmount: bountyArray[1],
      balance: bountyArray[2],
      data: bountyArray[3],
      bountyOpen: bountyArray[4]
    }
  },

  showBounty: function (bountyObject, index) {
    var bountyRow = $('#bountyRow');
    var bountyTemplate = $('#bountyTemplate').clone();

    try {
      bountyTemplate.find('.bounty-text').text(JSON.parse(bountyObject.data).join(""));
    } catch {
      bountyTemplate.find('.bounty-text').text(bountyObject.data);
    }


    bountyTemplate.find('.bounty-issuer').text(bountyObject.bountyIssuer);
    bountyTemplate.find('.fulfillment-amount').text(bountyObject.fulfillmentAmount);
    bountyTemplate.find('.bounty-balance').text(bountyObject.balance);
    bountyTemplate.find('.bounty-number').text(index);
    if (bountyObject.bountyOpen) {
      bountyTemplate.find('.btn-sm').attr('data-id', index)
      if (bountyObject.bountyIssuer != web3.eth.accounts[0]) {
        bountyTemplate.find('.btn-fulfillment').remove();
        bountyTemplate.find('.btn-close').remove();
      }
    } else {
      bountyTemplate.find('.btn-group').empty();
      bountyTemplate.find('.btn-group').append("<div class='btn btn-sm btn-outline-danger'>Bounty Closed</button>")
    }

    bountyRow.prepend(bountyTemplate.html());
  },

  showBounties: function () {
    $('#bountyRow').empty();

    var birdBountyInstance;

    App.getNumOfBounties().then(function () {
      App.contracts.BirdBounty.deployed().then(function (instance) {
        var promises = [];

        birdBountyInstance = instance;
        for (i = 0; i < App.numOfBounties; i++) {
          promises.push(i);
          promises.push(birdBountyInstance.getBounty(i))
        }

        return promises;
      }).then(function (promises) {
        Promise.all(promises).then(function (result) {
          for (i = 0; i < result.length; i += 2) {
            bountyObject = App.convertToBountyObject(result[i + 1]);
            App.showBounty(bountyObject, result[i])
          }
        });
      })
    });
  },

  oraclizeTweet: function () {
    var birdBountyInstance;
    $("#tweet-output").hide();
    var tweetUrl = $('#twitter-url').val();

    if (tweetUrl.includes("https://twitter.com/")) {
      tweetId = tweetUrl.replace("https://twitter.com/", "");

      App.contracts.BirdBounty.deployed().then(function (instance) {
        birdBountyInstance = instance;
        return birdBountyInstance.getTweetText(tweetId)

      }).then(function (result) {
        if (result == "") {
          return birdBountyInstance.oraclizeTweet(tweetId);
        } else {
          App.showOracleTweetText(result);
          return result;
        }
      }).then(function (result) {
        console.log("Oraclize Result:" + JSON.stringify(result));
        App.checkOracle(0);
      });
    } else {
      App.showErrorMessage("Bad URL.")
    }
  },

  showOracleTweetText: function (text) {
    $("#tweet-oracle-text").text(text);
    $("#message-output").hide();
    $("#tweet-output").show();
  },

  checkOracle: function (count) {
    if (count > 30) {
      App.showErrorMessage("Something went wrong with oraclizing this tweet.");
      return;
    }

    var birdBountyInstance;
    var tweetUrl = $('#twitter-url').val();

    if (tweetUrl.includes("https://twitter.com/")) {
      tweetId = tweetUrl.replace("https://twitter.com/", "");

      App.contracts.BirdBounty.deployed().then(function (instance) {
        birdBountyInstance = instance;

        return birdBountyInstance.getTweetText(tweetId)
      }).then(function (result) {
        if (result == "") {
          App.showNormalMessage("Loading... (" + count + ")");
          setTimeout(function () {
            App.checkOracle(count + 1);
          }, 1000);
        } else {
          App.showOracleTweetText(result);
        }

      })


    } else {
      console.log("Bad URL")
    }
  },

  createBirdBounty: function (fulfillmentAmount, postId, initialBalance) {
    var birdBountyInstance;
    console.log(fulfillmentAmount, postId, initialBalance)
    App.contracts.BirdBounty.deployed().then(function (instance) {
      birdBountyInstance = instance;
      var bountyId
      birdBountyInstance.createBounty.call(fulfillmentAmount, postId, { value: initialBalance })
        .then(function (id) {
          bountyId = id;
        }).then(function () {
          birdBountyInstance.createBounty(fulfillmentAmount, postId, { value: initialBalance })
            .then(function () {
              bountyId = bountyId.toNumber();
              console.log(bountyId);
              birdBountyInstance.getBounty(bountyId).then(function (result) {
                var bountyObject = App.convertToBountyObject(result);
                App.showBounties();
              });
            });
        });
    });
  },

  submitBirdBounty: function () {
    var fulfillmentAmount = $("#fulfillment-amount-input").val();
    var initialBalance = $("#initial-balance-input").val();
    var tweetUrl = $('#twitter-url').val();

    if (tweetUrl.includes("https://twitter.com/")) {
      tweetId = tweetUrl.replace("https://twitter.com/", "");
      App.createBirdBounty(fulfillmentAmount, tweetId, initialBalance);

    } else {
      App.showErrorMessage("Bad URL.")
    }

  },

  showCreateBountyInput: function () {
    $("#create-bounty-input").show();
    $("#fulfill-bounty-input").hide();
  },

  showFulfillBountyInput: function () {
    $("#fulfill-bountyid-input").empty();
    $("#fulfill-bountyid-message").empty();
    $("#fulfill-bird-bounty").prop('disabled', true)
    $("#fulfill-bird-bounty").removeClass("btn-outline-success").removeClass("btn-outline-danger").addClass("btn-outline-secondary")
          
    $("#fulfill-bountyid-input").append("<option selected>Choose...</option>")
    for (i = App.numOfBounties - 1; i >= 0; i--) {
      console.log(i)
      $("#fulfill-bountyid-input").append("<option val='" + i + "'>" + i + "</option>");
    }
    $("#create-bounty-input").hide();
    $("#fulfill-bounty-input").show();
  },

  checkBountyFulfill: function () {
    var birdBountyInstance;
    var tweetUrl = $('#twitter-url').val();
    var bountyId = $('#fulfill-bountyid-input').val();

    console.log(tweetUrl, bountyId)

    if (tweetUrl.includes("https://twitter.com/")) {
      tweetId = tweetUrl.replace("https://twitter.com/", "");

      App.contracts.BirdBounty.deployed().then(function (instance) {
        birdBountyInstance = instance;

        return birdBountyInstance.fulfillBounty.call(bountyId, tweetId)

      }).then(function (result) {
        if (result) {
          $("#fulfill-bountyid-message").text("Looks good! Claim your bounty.")
          $("#fulfill-bird-bounty").addClass("btn-outline-success").removeClass("btn-outline-danger").removeClass("btn-outline-secondary")
          $("#fulfill-bird-bounty").prop('disabled', false);
        }
      }).catch(function () {
        $("#fulfill-bountyid-message").text("This tweet won't work...")
        $("#fulfill-bird-bounty").prop('disabled', true);
        $("#fulfill-bird-bounty").removeClass("btn-outline-success").addClass("btn-outline-danger").removeClass("btn-outline-secondary")
      })
    }
  },

  claimBounty: function () {
    var birdBountyInstance;
    var tweetUrl = $('#twitter-url').val();
    var bountyId = $('#fulfill-bountyid-input').val();

    console.log(tweetUrl, bountyId)

    if (tweetUrl.includes("https://twitter.com/")) {
      tweetId = tweetUrl.replace("https://twitter.com/", "");

      App.contracts.BirdBounty.deployed().then(function (instance) {
        birdBountyInstance = instance;

        return birdBountyInstance.fulfillBounty(bountyId, tweetId);
      }).then(function () {
        $("#next-steps").empty();
        $("#next-steps").append(
          `<div class="alert alert-success" role="alert">
            <strong>Nice! You got paid.</strong> Now keep tweeting!
          </div>`
        );
      });
    }
  }

};

$(function () {
  $(window).load(function () {
    App.init();
  });
});
