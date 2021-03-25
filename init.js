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
veo.top = headers_object.top;
veo.height = function() {return veo.top()[1]};
veo.setKeys = keys.passphrase;
veo.pub = keys.pub;

var callCreator = function (func, argCount) {
	return function(...args) {
		if (args.length === argCount) args.push(console.log); 
		func(...args);
	}
}
veo.balance = callCreator(keys.balance,0);
veo.send = callCreator(spend_tx.send, 2);