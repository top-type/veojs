var veo = {};

veo.server = function(ip,port) {
	if (ip) {
		IP = ip;
		PORT = port;
	}
	else {
		return {ip: IP, port: PORT};
	}
};

veo.explorer = function(ip,port) {
	if (ip) {
		EXPLORE_IP = ip;
		EXPLORE_PORT = port;
	}
	else {
		return {ip: EXPLORE_IP, port: EXPLORE_PORT};
	}
};

veo.contractServer = function(ip,port) {
	if (ip) {
		CONTRACT_IP = ip;
		CONTRACT_PORT = port;
	}
	else {
		return {ip: CONTRACT_IP, port: CONTRACT_PORT};
	}
};

veo.top = headers_object.top;
veo.height = function() {return veo.top()[1]};
veo.setKeys = keys.passphrase;
veo.watch = keys.watch;
veo.pub = keys.pub;

var callCreator = function (func, argCount) {
	return function(...args) {
		if (args.length === argCount) args.push(console.log); 
		func(...args);
	}
}
veo.balance = callCreator(keys.balance,0);
veo.send = callCreator(spend_tx.send, 2);

function max(to, callback) {
	spend_tx.max_send_amount(veo.pub(), to, callback);
}
veo.max = callCreator(max, 1);

function sweep(to, callback) {
	veo.max(to, function(amount, type) {
		veo.send(to, amount, callback);
	});
}
veo.sweep = callCreator(sweep, 1);

function makeTx(to, amount, callback) {
	spend_tx.make_tx(to, keys.pub(), amount, callback); 
}
veo.makeTx = callCreator(makeTx, 2);

function subBalance(cid, callback) {
	merkle.request_proof("contracts", cid, function(c) {
		var many_types;
    if(c == "empty"){
      callback("Contract doesn't exist");
			return;
    } 
		else {
			many_types = c[2];
    }
		function balanceBuilder(type, acc) {
			if (type === 0) {
				 rpc.post(["read", 3, cid], function(oracle_text) {
					var text = oracle_text ? atob(oracle_text[1]) : undefined;
					callback({id: cid, text: text, balances: acc});
				 }, CONTRACT_IP, CONTRACT_PORT);
				 return;
			}
			var trie_key = sub_accounts.normal_key(veo.pub(), cid, type);
			rpc.post(["sub_accounts", trie_key], function(x) {
				let res = {type: type};
				if (x[0] === "sub_acc") res.unconfirmed = x[1];
				merkle.request_proof("sub_accounts", trie_key, function(s) {
					if (s[0] === "sub_acc") res.confirmed = s[1];
					if (res.confirmed || res.unconfirmed) acc.push(res);
					balanceBuilder(type-1, acc)
				});
			});
		}
		balanceBuilder(many_types, []);
	})
}
veo.subBalance = callCreator(subBalance, 1);

function myContracts(callback) {
	rpc.post(["account", keys.pub()], function(response) {
		var res = {};
		res.contracts = response[1][3].slice(1);
		res.markets = response[1][4].slice(1);
		callback(res.contracts);
	}, EXPLORE_IP, EXPLORE_PORT);
}
veo.myContracts = callCreator(myContracts, 0);

function balances(callback) {
	veo.myContracts(function(res) {
		function rateLimited(contracts, delay) {
			if (contracts.length === 0) return;
			veo.subBalance(contracts.pop());
			setTimeout(function () {rateLimited(contracts, delay)}, delay);
		}
		rateLimited(res, 500);
	});
}
veo.balances = callCreator(balances, 0);

function sendSub(cid, type, to, amount, callback){
  rpc.post(["account", veo.pub()], function(account){
    var nonce = account[2] + 1;
    var fee = 152050;
    var tx = ["sub_spend_tx",
                veo.pub(),
                nonce,
                fee,
                to,
                amount,
                cid,
                type
							];
    console.log(tx);
    console.log(JSON.stringify(tx));
    var stx = keys.sign(tx);
		rpc.post(["txs", [-6, stx]], callback);
  });
};
veo.sendSub = callCreator(sendSub, 4);

function markets(callback) {
	rpc.post(["markets"], function(l) {
            l = l.slice(1);
            callback(l)
        }, CONTRACT_IP, CONTRACT_PORT);
};
veo.markets = callCreator(markets, 0);

function offers(callback) {
	function builder(marketList, acc) {
		if (marketList.length == 0) return callback(acc);
		var m = marketList[0];
		rpc.post(["read", m[2]], function(z) {
			var orders = z[1][7];
            orders = orders.slice(1);
			acc.push({market: m[2], cid1: m[3], type1: m[4], cid2: m[5], type2: m[6], offers: orders});
			builder(marketList.slice(1), acc)
		}, CONTRACT_IP, CONTRACT_PORT);
    }
	veo.markets(function (markets) {
		builder(markets, []);
	});
};
veo.offers = callCreator(offers, 0);
