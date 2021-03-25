
var spend_tx = (function () {
    
    var fee;
    function fee_lookup(to, callback){
        rpc.post(["account", to], function(acc){
            var tx_type = "spend";
            var gov_id = 15;
            if((acc === 0) || (acc === "empty")){
                tx_type = "create_acc_tx";
                gov_id = 14;
            };
	    merkle.request_proof("governance", gov_id, function(gov_fee) {
		var fee = tree_number_to_value(gov_fee[2]) + 50;
                return(callback(fee, tx_type));
            });
        });
    };
    function make_tx(to, from, amount, callback){
        rpc.post(["account", from], function(from_acc){
            return(make_tx2(from_acc, to, from, amount, callback));
        });
    };
    function make_tx2(from_acc, to, from, amount, callback){
        var nonce = from_acc[2] + 1;
        fee_lookup(to, function(fee, tx_type){
            var tx = [tx_type, from, nonce, fee, to, amount];
            if(tx_type === "spend"){
                tx = tx.concat([0]);
            };
            return(callback(tx));
        });
    };
    
    function send_tx(tx, callback) {
      var stx = keys.sign(tx);
      post_txs([stx], function(msg){
        callback(msg);
      });
    };
		
		function send(to, amount, callback) {
			make_tx(to, keys.pub(), amount, function(tx) {send_tx(tx, callback);});
		}
		
    function max_send_amount(pub, to, callback){
        rpc.post(["account", pub], function(acc){
            var bal = acc[1];
            fee_lookup(to, function(fee, tx_type){
                callback(bal-fee-1, tx_type);
            });
            //return(fee_lookup(to, callback));//callback takes 2 inputs, fee and tx_type.
        });
    };
    return({
        make_tx:make_tx,
        max_send_amount: max_send_amount,
				send: send
    });
})();

