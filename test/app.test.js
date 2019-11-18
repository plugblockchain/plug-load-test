'user strict';
const assert = require('assert');
const app = require('../src/app.js');



describe('Send_and_receive_keypair_selection', function() {
  it('Random_testing', function() {
    // probability of randomness resulting in missing a failure = (1 - (4/5)^25) = 0.3%
      for (i=0; i<100; i++) {
      let keypairs = ['A', 'B', 'C', 'D', 'E'];
      let [sender, receiver] = app.selectSendReceiveKeypairs(keypairs.slice(0));

      assert.ok( keypairs.includes(sender));
      assert.ok( keypairs.includes(receiver));
      assert.ok( sender != receiver);
    }
  });
  it('Single_Item', function() {
    let keypairs = ['A']
    let [sender, receiver] = app.selectSendReceiveKeypairs(keypairs.slice(0));

    assert(sender === null);
    assert(receiver === null);
  });
  it('Small_array', function() {
    let keypairs = ['A', 'B'];
    let [sender, receiver] = app.selectSendReceiveKeypairs(keypairs.slice(0));

    assert.ok( keypairs.includes(sender));
    assert.ok( keypairs.includes(receiver));
    assert.ok( sender != receiver);
  });

  it('Big_array', function() {
    let keypairs = [
      'A00', 'B00', 'C00', 'D00', 'E00', 'A10', 'B10', 'C10', 'D10', 'E10', 'A20', 'B20', 'C20', 'D20', 'E20', 'A30', 'B30', 'C30', 'D30', 'E30', 'A40', 'B40', 'C40', 'D40', 'E40',
      'A01', 'B01', 'C01', 'D01', 'E01', 'A11', 'B11', 'C11', 'D11', 'E11', 'A21', 'B21', 'C21', 'D21', 'E21', 'A31', 'B31', 'C31', 'D31', 'E31', 'A41', 'B41', 'C41', 'D41', 'E41',
      'A02', 'B02', 'C02', 'D02', 'E02', 'A12', 'B12', 'C12', 'D12', 'E12', 'A22', 'B22', 'C22', 'D22', 'E22', 'A32', 'B32', 'C32', 'D32', 'E32', 'A42', 'B42', 'C42', 'D42', 'E42',
      'A03', 'B03', 'C03', 'D03', 'E03', 'A13', 'B13', 'C13', 'D13', 'E13', 'A23', 'B23', 'C23', 'D23', 'E23', 'A33', 'B33', 'C33', 'D33', 'E33', 'A43', 'B43', 'C43', 'D43', 'E43',
      'A04', 'B04', 'C04', 'D04', 'E04', 'A14', 'B14', 'C14', 'D14', 'E14', 'A24', 'B24', 'C24', 'D24', 'E24', 'A34', 'B34', 'C34', 'D34', 'E34', 'A44', 'B44', 'C44', 'D44', 'E44'
    ];
    let [sender, receiver] = app.selectSendReceiveKeypairs(keypairs.slice(0));

    assert.ok( keypairs.includes(sender));
    assert.ok( keypairs.includes(receiver));
    assert.ok( sender != receiver);
  });

  it('Duplicates Allowed', function() {
    let keypairs = ['A','A'];
    let [sender, receiver] = app.selectSendReceiveKeypairs(keypairs.slice(0));

    assert.ok( sender == receiver);
  });
  
});