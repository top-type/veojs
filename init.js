var veo = {};
var ZERO = btoa(array_to_string(integer_to_array(0, 32)));

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
veo.forget = keys.forget;
veo.keys = keys.keys_internal;

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

function marketsAndOrders(callback) {
	function builder(marketList, acc) {
		if (marketList.length == 0) return callback(acc);
		var m = marketList[0];
		rpc.post(["read", 3, m[3]], function(oracle_text1) {
			rpc.post(["read", 3, m[5]], function(oracle_text2) {
				rpc.post(["read", m[2]], function(z) {
					var orders = z[1][7];
					orders = orders.slice(1);
					t1 = oracle_text1 ? atob(oracle_text1[1]) : undefined;
					if (m[4] == 0) t1 = 'Veo';
					t2 = oracle_text2 ? atob(oracle_text2[1]) : undefined;
					if (m[6] == 0) t2 = 'Veo';
					acc.push({market: m[2], text1: t1, text2: t2,
					cid1: m[3], type1: m[4], cid2: m[5], type2: m[6], orders: orders});
					builder(marketList.slice(1), acc)
				}, CONTRACT_IP, CONTRACT_PORT);
			}, CONTRACT_IP, CONTRACT_PORT);
		}, CONTRACT_IP, CONTRACT_PORT);
    }
	veo.markets(function (markets) {
		builder(markets, []);
	});
};
veo.marketsAndOrders = callCreator(marketsAndOrders, 0);

function trades(callback) {
	veo.marketsAndOrders(function(res) {
		var tids = [];
		res.forEach(function(m) {
			m.orders.forEach(function(o) {
				tids.push([o[3], m.text1, m.text2]);
			});
		});
		function builder(tids, acc) {
			if (tids.length == 0) return callback(acc);
			rpc.post(["read", 2, tids[0][0]], function(t){
				acc.push({id: tids[0][0], text1: tids[0][1], text2: tids[0][2], type : t[1][0], creator: t[1][1], 
				cid1: t[1][4], cid2: t[1][7], type1: t[1][5], type2: t[1][8], amount1: t[1][6], raw: t,
				amount2: t[1][9],});
				builder(tids.slice(1), acc);
			}, CONTRACT_IP, CONTRACT_PORT);
		};
		builder(tids, []);
	});
}
veo.trades = callCreator(trades, 0);

function createOffer(text, flag1, flag2,  veoAmount, subAmount, expires) {
	//flag1 true or false offer and flag2 veo->sub or vice versa
	var MP = 1;
	var contract = scalar_derivative.maker(text, MP);
	var CH = scalar_derivative.hash(contract);
	var cid = binary_derivative.id_maker(CH, 2);
	var swap = {};
	if (flag2) {
        swap.type1 = 0;
        swap.type2 = flag1 ? 1 : 2;
        swap.cid1 = ZERO;
        swap.cid2 = cid;
        swap.amount1 = veoAmount;
        swap.amount2 = subAmount;

	}
	else {
		swap.type2 = 0;
        swap.type1 = flag1 ? 1 : 2;
        swap.cid2 = ZERO;
        swap.cid1 = cid;
        swap.amount2 = veoAmount;
        swap.amount1 = subAmount;
	} 
	swap.partial_match = false;
    swap.acc1 = keys.pub();
    swap.end_limit = headers_object.top()[1] + expires;
	var signed_offer = swaps.pack(swap);
	return signed_offer;
}

function makeBet(text, flag, amount1, amount2, expires, callback) {
	var offer = createOffer(text, flag, true, amount1, amount2, expires);
	var fee = 200000;
	var offer99 = createOffer(text, flag, false, Math.round((amount2 * 0.998) - (fee * 5)), amount2, expires+5);
	console.log(offer,offer99);
	var MP = 1;
	rpc.post(["add", 3, btoa(text), 0, MP, ZERO, 0], function(res1) {
		rpc.post(["add", offer, offer99], function(res2) {
			callback(res1,res2);
		}, CONTRACT_IP, CONTRACT_PORT)
	},CONTRACT_IP, CONTRACT_PORT);
};
veo.makeBet = callCreator(makeBet, 5);


function accept(text, swap_offer) {
	var MP = 1;
	var contract = scalar_derivative.maker(text, MP);
	var CH = scalar_derivative.hash(contract);
    var MT = 2;
    var SourceType = 0;
	var cid = binary_derivative.id_maker(CH, 2);
	if ((cid !== swap_offer[1][7]) || (ZERO !== swap_offer[1][4])) return ("Mismatch");
	merkle.request_proof("accounts", keys.pub(), function(Acc){
		if (Acc === 'empty') return("Account not exist");
		var bal = Acc[1];
		var Nonce = Acc[2] + 1;
		var mintTx = ["contract_use_tx", 0,0,0, cid, swap_offer[1][9], 2, ZERO, 0];
		var txs = [];
		merkle.request_proof("contracts", cid, function(Contract){
			if(Contract == "empty"){
				var contractTx = ["contract_new_tx", keys.pub(), CH, 0, MT, ZERO, SourceType];
				txs.push(contractTx);
			};
			txs.push(mintTx);
			var swap_tx = ["swap_tx2", keys.pub(), 0, 0, swap_offer, 1];
			txs.push(swap_tx);
			multi_tx.make(txs, function(tx) {
				console.log(tx);
				var stx = keys.sign(tx);
				post_txs([stx], console.log);
			});
			
		});
		
	});
return;
}


