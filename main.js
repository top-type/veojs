var balanceDB = {};
var MODE = 0;
function balanceUpdater() {
	if (!veo.keys()) return;
	if (!balanceDB[veo.pub()]) balanceDB[veo.pub()] = {};
	veo.balances(function(res) {
		balanceDB[veo.pub()][res.id] = res;
	}); 
};
var subSelection = {cid: ZERO, type: 0, text: 'VEO'};
function buildPositionsTable() {
	var res = '<table class="table table-hover"><thead></thead><tbody>';
	for (const property in balanceDB[veo.pub()]) {
		var item = balanceDB[veo.pub()][property];
		if (!item || !item.balances) continue;
		item.balances.forEach(function(b) {
			var id = b.type + property;
			var text = item.text;
			if(!b.confirmed) b.confirmed = 0;
			var u = (b.unconfirmed - b.confirmed)/1e8;
			var balance = b.confirmed/1e8;
			if (u > 0) {
			balance += ' <span class="text-success">(+'+u+')</span>';
			}
			if (u < 0) {
			balance += ' <span class="text-danger">('+u+')</span>';
			}
			if (b.type === 2) text = '<span class="text-warning">FALSE</span> ' + text;
			else text = '<span class="text-primary">TRUE</span> ' + text;
			res += '<tr class="table-active positionTr" id="'+id+'">' +
						'<td>'+text+'</td>' +
						'<td>'+balance+'</td>' +
						'</tr>';
		});
	}
	res += '</tbody></table>';
	$('#positionsTable').html(res);
	$('.positionTr').click(function(e) {
		e.preventDefault();
		var type = parseInt(e.currentTarget.id.substring(0,1));
		var contract = e.currentTarget.id.substring(1);
		var text = type === 1 ? 'TRUE ' : 'FALSE ';
		text += balanceDB[veo.pub()][contract].text;
		subSelection.text = text;
		subSelection.cid = contract;
		subSelection.type = type;
		$('#type').val(text);
	});
}

function buildBrowseTable() {
	veo.trades(function(trades) {
		var res = '<table class="table table-hover"><thead></thead><tbody>';
		if (MODE === 0) {
			res += '<tr><th scope="col">Event</th><th scope="col">Risk</th><th scope="col">To win</th></tr>'
		}
		else {
			res += '<tr><th colspan="2" scope="col">Gain</th><th colspan="2" scope="col">Lose</th></tr>'
		}
    
		tidLookup = {};
		trades.forEach(function(trade) {
			var falseSpan = '<span class="text-warning">FALSE</span> ';
			var trueSpan = '<span class="text-primary">TRUE</span> ';
			var mod1 = trade.type1 == 2 ? falseSpan : trueSpan;
			if (trade.type1 === 0) mod1 = '';
			var mod2 = trade.type2 == 2 ? falseSpan : trueSpan;
			if (trade.type2 === 0) mod2 = '';
			console.log(trade);
			var description;
			tidLookup[trade.id] = [trade.text2,trade.raw];
			if (MODE === 1) {
				res += '<tr class="table-active browseTr" style="cursor:pointer" id="'+trade.id+'">' +
						'<td><span class="text-success">'+trade.amount1/1e8+'</span></td>' +
						'<td>'+ mod1 + trade.text1+'</td>' +
						'<td><span class="text-danger">'+trade.amount2/1e8+'</span></td>' +
						'<td>'+ mod2 + trade.text2+'</td>' +
						'</tr>';
				description = 'Trade ' + trade.amount2/1e8 + ' of ' + trade.text2 + ' for ' +
				trade.amount1/1e8 + ' of ' + trade.text1 + '?';
						
			}
			else if ((MODE === 0) && (trade.type1 === 0)) {
				var riskAmount = (trade.amount2 - trade.amount1)/1e8;
				var mod2 = trade.type2 == 2 ? trueSpan : falseSpan;
				res += '<tr class="table-active browseTr" style="cursor:pointer" id="'+trade.id+'">' +
				'<td>'+ mod2 + trade.text2+'</td>' +
				'<td><span class="text-danger">'+ riskAmount+'</span></td>' +
				'<td><span class="text-success">'+trade.amount1/1e8+'</span></td>'
				description = 'Risk ' + riskAmount + ' to win ' + trade.amount1/1e8 + ' if ' +
				mod2 + trade.text2;
			}
			tidLookup[trade.id].push(description);
		
		});
		res += '</tbody></table>';
		$('#browse').html(res);
		$('.browseTr').click(function(e) {
			e.preventDefault();
			var t = tidLookup[e.currentTarget.id];
			confirmAction(t[2], 'Trade', function() {
				accept(t[0], t[1], console.log); 
			})
		});
	});
}

function updateBalance() {
	if (!veo.keys()) return;
	veo.balance(function(res) {
		console.log(res);
		if (typeof res.confirmed !== 'number') res.confirmed = 0;
		if (typeof res.unconfirmed !== 'number') res.unconfirmed = res.confirmed;
		var html = veo.pub().substring(0,5) + ': ' + res.confirmed/1e8
		var u = (res.unconfirmed - res.confirmed)/1e8;
		if (u > 0) {
			html += ' <span class="text-success">(+'+u+')</span>';
		}
		if (u < 0) {
			html += ' <span class="text-danger">('+u+')</span>';
		}
		$('#walletLink').html(html);
	})
};

$('#setButton').click(function(e) {
	e.preventDefault();
	var passphrase = $('#passphrase').val();
	$('#passphrase').val('');
	localStorage.setItem('passphrase', passphrase);
	veo.setKeys(passphrase);
	$('#walletLink').html(veo.pub().substring(0,5));
	$('#pub').text(veo.pub());
	$('#holdingsLink').show();
	$('#receiveLink').show();
	$('#createLink').show();
	$('#forgetLink').show();
	$('#newAccountLink').hide();
	route('holdings');
	updateBalance();
	balanceUpdater();
});

function route(r) {
	$('.route').hide();
	$('#'+r).show();
};

$('#newAccountLink').click(function(e) {
	e.preventDefault();
	route('newAccount');
});

$('#receiveLink').click(function(e) {
	e.preventDefault();
	route('receive');
});

$('#browseLink').click(function(e) {
	e.preventDefault();
	route('browse');
	buildBrowseTable();
});

$('#holdingsLink').click(function(e) {
	e.preventDefault();
	route('holdings');
	buildPositionsTable();
});

$('#createLink').click(function(e) {
	e.preventDefault();
	route('create');
});

$('#forgetLink').click(function(e) {
	e.preventDefault();
	localStorage.removeItem('passphrase');
	veo.forget();
	$('#positionsTable').html('');
	$('#walletLink').html('VEOEX');
	$('#holdingsLink').hide();
	$('#receiveLink').hide();
	$('#createLink').hide();
	$('#forgetLink').hide();
	$('#newAccountLink').show();
	route('newAccount');
});

$('#settingsLink').click(function(e) {
	e.preventDefault();
	route('settings');
});

$('.navbar-nav>li>a').on('click', function(){
    $('.navbar-collapse').collapse('hide');
});

$('#walletLink').click(function(e) {
	e.preventDefault();
	if (!veo.keys()) {
		route('newAccount');
		return;
	}
	route('holdings');
	subSelection.text = 'VEO';
	subSelection.cid = ZERO;
	subSelection.type = 0;
	$('#type').val('VEO');
});

$('#sendButton').click(function(e) {
	e.preventDefault();
	var type = 'Send';
	var recipient = $('#recipient').val();
	var amount = Math.round(parseFloat($('#amount').val()) * 1e8);
	var t = 'Send ' + amount/1e8 + ' <em class="text-muted">' + subSelection.text + '</em> to ' + recipient.substring(0,20) + '... ?';
	if (subSelection.cid === ZERO) {
		function sender() {
			veo.send(recipient, amount, function (res) {
			updateBalance();
			});
		}
		confirmAction(t, type, sender);
		
	}
	else {
		function sender() {
			veo.sendSub(subSelection.cid, subSelection.type, recipient, amount, function (res) {
				balanceUpdater();
				updateBalance();
			});
		}
		confirmAction(t, type, sender);
	}
	$('.sendInput').val('');
});

$('#maxButton').click(function(e) {
	e.preventDefault();
	if (subSelection.cid === ZERO) {
		var recipient = $('#recipient').val();
		veo.max(recipient, function (res) {
		$('#amount').val(res/1e8)
		return;
		});
	}
	else {
		var b = balanceDB[veo.pub()][subSelection.cid].balances;
		var amount = 0;
		if (b[0].type === subSelection.type) amount = b[0].unconfirmed;
		else if (b[1].type === subSelection.type) amount = b[1].unconfirmed;
		else return false;
		$('#amount').val(amount/1e8);
	}
});

$('#copyButton').click(function(e) {
	e.preventDefault();
	var copyToClipboard = function(secretInfo) {
		var $body = document.getElementsByTagName('body')[0];
        var $tempInput = document.createElement('INPUT');
        $body.appendChild($tempInput);
        $tempInput.setAttribute('value', secretInfo)
        $tempInput.select();
        document.execCommand('copy');
        $body.removeChild($tempInput);
    }
	copyToClipboard(veo.pub());
	
});

$('#createButton').click(function(e) {
	e.preventDefault();
	var text = $('#statement').val();
	var amount1 =  Math.round(parseFloat($('#amount1').val())*1e8);
	var amount2 =  Math.round(parseFloat($('#amount2').val())*1e8);
	var expires =  parseInt($('#expires').val());
	var flag = $('#statementSelect').val() === 'True';
	function creator() {
		veo.makeBet(text, flag, amount1, amount1 + amount2, expires, function(res) {
			console.log(res);
			$('.createInput').val('')
		});
	}
	var t = 'Create offer risking ' + amount1/1e8 + ' to win ' + amount2/1e8 + ' if ' + 
	text + ' is ' + flag + '. Expires in ' + expires + ' blocks.';
	confirmAction(t, 'Create', creator);
	
});

$('#modeSelect').on('change', function (e) {
    e.preventDefault();
	updateSettings();
});

$('#nodeButton').click(function(e) {
	e.preventDefault();
	var ip = $('#nodeIp').val();
	var port = parseInt($('#nodePort').val())
	veo.server(ip, port);
	updateSettings();
});

$('#contractButton').click(function(e) {
	e.preventDefault();
	var ip = $('#contractIp').val();
	var port = parseInt($('#contractPort').val())
	veo.server(ip, port);
	updateSettings();
});

$('#exploreButton').click(function(e) {
	e.preventDefault();
	var ip = $('#exploreIp').val();
	var port = parseInt($('#explorePort').val())
	veo.server(ip, port);
	updateSettings();
});

function cleanup() {
	var txs = [];
	var contractList = balanceDB[keys.pub()]
	for (property in contractList) { 
	if (contractList[property].balances.length === 0) continue;
		var tx = ["contract_use_tx", 0,0,0,
			property, -contractList[property].balances[0].unconfirmed, 2,
			ZERO, 0];
	txs.push(tx);
	}
	multi_tx.make(txs, function(tx) {
		console.log(tx);
		var stx = keys.sign(tx);
		post_txs([stx], function(res) {
			console.log(res);
		});
	});
}

function updateHeight() {
	$('#settingsLink').text('Settings: ' + veo.height());
};

function updateSettings() {
	$('#nodeServer').text('Node ('+IP+', '+PORT+')');
	$('#contractServer').text('Contracts ('+CONTRACT_IP+', '+CONTRACT_PORT+')');
	$('#exploreServer').text('Explorer ('+EXPLORE_IP+', '+EXPLORE_PORT+')');
	var mode = $('#modeSelect').val();
	if (mode === 'Basic') MODE = 0;
	else MODE = 1;
}

function confirmAction(text, type, action) {
	$('#modalButton').unbind();
	$('#modalText').html(text);
	$('#modalButton').text(type);
	$('#modalButton').click(function() {
		action();
		$('.modal').modal('hide')
	})
	
$('.modal').modal('show')

}


$(document).ready(function () {
	if (localStorage.getItem('passphrase')) {
		$('#newAccountLink').hide();
		veo.setKeys(localStorage.getItem('passphrase'));
		$('#pub').text(veo.pub());
		updateBalance();
		balanceUpdater();
		route('holdings');
	}
	else {
		$('#walletLink').html('VEOEX');
		veo.forget();
		route('newAccount');
		$('#sendLink').hide();
		$('#receiveLink').hide();
		$('#createLink').hide();
		$('#forgetLink').hide();
	}
	setInterval(function() {
		updateBalance();
		buildBrowseTable()
	}, 20000)
	setInterval(function() {
		balanceUpdater();

	}, 20000)
	setInterval(function() {
		updateHeight();
		buildPositionsTable()
	}, 2000)
	
	$('#type').val('VEO');
	updateHeight();
	buildBrowseTable()
	buildPositionsTable()
	updateSettings();
});