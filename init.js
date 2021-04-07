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
			}
			var trie_key = sub_accounts.normal_key(veo.pub(), cid, type);
			rpc.post(["sub_accounts", trie_key], function(x) {
				if (x[0] === "sub_acc") acc.push([x[1], type]);
				balanceBuilder(type-1, acc)
			});
		}
		balanceBuilder(many_types, []);
	})
}
veo.subBalance = callCreator(subBalance, 1);

function myContracts(callback) {
	rpc.post(["account", keys.pub()], function(response) {
		var res = {};
		res.accounts = response[1][3].slice(1);
		res.shares = response[1][4].slice(1);
		callback(res);
	}, EXPLORE_IP, EXPLORE_PORT);
}
veo.myContracts = callCreator(myContracts, 0);

function balances(callback) {
	veo.myContracts(function(res) {
		res.accounts.forEach(function (id) {
			veo.subBalance(id, callback);
		});
		res.shares.forEach(function (id) {
			veo.subBalance(id, callback);
		});
	});
}
veo.balances = callCreator(balances, 0);


