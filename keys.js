
function keys_function1() {
    var ec = new elliptic.ec('secp256k1');
    var keys_internal;
    keys_internal = new_keys();
    
    function input_maker(val) {
        var x = document.createElement("input");
        x.type = "text";
        x.value = val;
        return x;
    }
    function new_keys_watch(x) {
			return ec.keyFromPublic(x);
    }
    function new_keys_entropy(x) {
        return ec.genKeyPair({entropy: hash(serialize([x]))});
    }
    function new_keys() {
        return ec.genKeyPair();
    }
    function pubkey_64() {
        var pubPoint = keys_internal.getPublic("hex");
        return btoa(fromHex(pubPoint));
    }
    function powrem(x, e, p) {
        //if (e == 0n) {
        if (e == 0) {
            //return 1n;
            return 1;
        //} else if (e == 1n) {
        } else if (e == 1) {
            return x;
        //} else if ((e % 2n) == 0n) {
        } else if ((e % 2) == 0) {
            return powrem(((x * x) % p),
                          //(e / 2n),
                          (e / 2),
                          p);
        } else {
            //return (x * powrem(x, e - 1n, p)) % p;
            return (x * powrem(x, e - 1, p)) % p;
        }
    };
    function decompress_pub(pub) {
        //pub = "AhEuaxBNwXiTpEMTZI2gExMGpxCwAapTyFrgWMu5n4cI";
        //var p = 115792089237316195423570985008687907853269984665640564039457584007908834671663n;
        var p = 0;
        var b = atob(pub);
        var a = string_to_array(b);
        var s = BigInt(a[0] - 2);
        var x = big_array_to_int(a.slice(1, 33));
        //var y2 = (((((x * x) % p) * x) + 7n) % p);
        var y2 = (((((x * x) % p) * x) + 7) % p);
        //var y = powrem(y2, ((p+1n) / 4n), p);
        var y = powrem(y2, ((p+1) / 4), p);
        //if (!(s == (y % 2n))) {
        if (!(s == (y % 2))) {
            y = ((p - y) % p);
        }
        pub = [4].concat(big_integer_to_array(x, 32)).concat(big_integer_to_array(y, 32));
        return btoa(array_to_string(pub));
    }
    function compress_pub(p) {
        var b = atob(p);
        var a = string_to_array(b);
        var x = a.slice(1, 33);
        var s = a[64];
        var f;
        if ((s % 2) == 0) {
            f = 2;
        } else {
            f = 3;
        }
        return btoa(array_to_string([f].concat(x)))
    }
    function raw_sign(x) {
        var h = hash(x);
        var sig = keys_internal.sign(h);
        var sig2 = sig.toDER();
        return btoa(array_to_string(sig2));
    }
    function sign_tx(tx) {
        var sig;
        var stx;
	if (tx[0] == "signed") {
	    console.log(JSON.stringify(tx));
            //var sig = raw_sign(tx[1]);
	    sig = btoa(array_to_string(sign(tx[1], keys_internal)));
	    stx = tx;

	} else {
            sig = btoa(array_to_string(sign(tx, keys_internal)));
            stx = ["signed", tx, [-6], [-6]];
	}
	var pub = pubkey_64();
	if ((stx[1][0] == -7) || (pub == stx[1][1])) {
	    stx[2] = sig;
	} else if (pub == stx[1][2]) {
	    stx[3] = sig;
	} else {
	    console.log(JSON.stringify(tx));
	    throw("sign error");
	}
        return stx;
    }
    function watch_only_func(v) {
			keys_internal = new_keys_watch(string_to_array(atob(v)));
    }
		
    function check_balance(Callback) {
        var trie_key = pubkey_64();
        //var top_hash = hash(headers_object.serialize(headers_object.top()));
        merkle.request_proof("accounts", trie_key, function(x) {
	    Callback(x[1]);
        });
    }
    function get_balance(callback) {
        var trie_key = pubkey_64();
        var headers_top = headers_object.top();
        rpc.post(["account", trie_key], function(unconfirmed) {
            var U = unconfirmed[1];
            
            merkle.request_proof("accounts", trie_key, function(x) {
                var C = x[1];
                var res = {confirmed: C, unconfirmed: U}
								callback(res);
            });
        });
    }
  
    function encrypt(val, to) {
        return encryption_object.send(val, to, keys_internal);
    }
    function decrypt(val) {
	return encryption_object.get(val, keys_internal);
    }
    return {make: new_keys,
            pub: pubkey_64,
            raw_sign: raw_sign,
            sign: sign_tx,
            ec: (function() { return ec; }),
						watch: watch_only_func,
						passphrase: function (phrase) {keys_internal = new_keys_entropy(phrase)},
						forget: function (phrase) {keys_internal = undefined},
            encrypt: encrypt,
            decrypt: decrypt,
            balance: get_balance,
            keys_internal: (function() {return keys_internal;}),
            compress: compress_pub,
            decompress: decompress_pub };
}
var keys = keys_function1();
