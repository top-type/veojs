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
		EXPLORE:PORT = port;
	}
	else {
		return {ip: EXPLORE_IP, port: EXPLORE_PORT};
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

function balances(callback) {
	rpc.post(["account", keys.pub()], function(response) {
		var res = {};
		res.accounts = response[1][3].slice(1);
		res.shares = response[1][4].slice(1);
		callback(res);
	}, EXPLORE_IP, EXPLORE_PORT);
}
veo.balances = callCreator(balances, 0);
