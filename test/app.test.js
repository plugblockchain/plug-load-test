const assert = require('assert');
const app = require('../src/app.js');

class FakeKeyring {
  constructor() {
  }

  addFromUri(name, meta_data) {
    const keypair = {
      meta: {
        name: meta_data.name
      }
    };
    return keypair;
  }
}

describe('Steve Factory - Creating Steves', function() {
  it('Zero Steves is an empty array', function() {
    steves = app.createTheSteves(0, new FakeKeyring());

    assert.equal(steves.length, 0);
  });

  it('One Steve is an array of size one', function() {
    steves = app.createTheSteves(1, new FakeKeyring());

    assert.equal(steves.length, 1);
  });

  it('Five Steves is an array of size five', function() {
    steves = app.createTheSteves(5, new FakeKeyring());

    assert.equal(steves.length, 5);
  });

  it('Steves have unique names', function() {
    steves = app.createTheSteves(2, new FakeKeyring());

    assert.notEqual(steves[0].meta.name, steves[1].meta.name);
  });


});