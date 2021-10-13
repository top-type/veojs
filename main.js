var balanceDB = {};
function balanceUpdater() {
	if (!veo.keys()) return;
	veo.balances(function(res) {
	balanceDB[res.id] = res;
	}); 
};
var subSelection = {cid: undefined, type: undefined, text: undefined};
function buildPositionsTable() {
	var res = '<table class="table table-hover"><thead></thead><tbody>';
	for (const property in balanceDB) {
		var item = balanceDB[property];
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
		text += balanceDB[contract].text;
		subSelection.text = text;
		subSelection.cid = contract;
		subSelection.type = type;
		$('#subType').val(text);
	});
}

function buildBrowseTable() {
	veo.trades(function(trades) {
		var res = '<table class="table table-hover"><thead></thead><tbody>';
		tidLookup = {};
		trades.forEach(function(trade) {
			var mod1 = trade.type1 == 2 ? '<span class="text-warning">NOT</span> ' : '';
			var mod2 = trade.type2 == 2 ? '<span class="text-warning">NOT</span> ' : '';
			console.log(trade);
			res += '<tr class="table-active browseTr" id="'+trade.id+'">' +
						'<td><span class="text-success">+'+trade.amount1/1e8+'</span></td>' +
						'<td>'+ mod1 + trade.text1.substring(0, 10)+'</td>' +
						'<td><span class="text-danger">-'+trade.amount2/1e8+'</span></td>' +
						'<td>'+ mod2 + trade.text2.substring(0, 10)+'</td>' +
						'</tr>';
		tidLookup[trade.id] = [trade.text2,trade.raw];
		});
		res += '</tbody></table>';
		$('#browse').html(res);
		$('.browseTr').click(function(e) {
			e.preventDefault();
			accept(...tidLookup[e.currentTarget.id]);
		});
	});
}

function updateBalance() {
	if (!veo.keys()) return;
	veo.balance(function(res) {
		console.log(res);
		if (typeof res.confirmed !== 'number') res.confirmed = 0;
		if (typeof res.unconfirmed !== 'number') res.unconfirmed = 0;
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
	$('#sendLink').show();
	$('#receiveLink').show();
	$('#createLink').show();
	$('#forgetLink').show();
	$('#newAccountLink').hide();
	route('send');
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

$('#sendLink').click(function(e) {
	e.preventDefault();
	route('send');
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

$('#positionsLink').click(function(e) {
	e.preventDefault();
	route('positions');
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
	$('#walletLink').html('VEOEX');
	$('#sendLink').hide();
	$('#receiveLink').hide();
	$('#createLink').hide();
	$('#forgetLink').hide();
	$('#newAccountLink').show();
	route('newAccount');
});

$('.navbar-nav>li>a').on('click', function(){
    $('.navbar-collapse').collapse('hide');
});

$('#sendButton').click(function(e) {
	e.preventDefault();
	var recipient = $('#recipient').val();
	var amount = Math.round(parseFloat($('#amount').val()) * 1e8);
	veo.send(recipient, amount, function (res) {
		updateBalance();
	});
});

$('#maxButton').click(function(e) {
	e.preventDefault();
	var recipient = $('#recipient').val();
	veo.max(recipient, function (res) {
		$('#amount').val(res/1e8)
	});
});

$('#subSendButton').click(function(e) {
	e.preventDefault();
	var recipient = $('#subRecipient').val();
	var amount = Math.round(parseFloat($('#subAmount').val()) * 1e8);
	veo.sendSub(subSelection.cid, subSelection.type, recipient, amount, function (res) {
		balanceUpdater();
	});
});

$('#subMaxButton').click(function(e) {
	e.preventDefault();
	var b = balanceDB[subSelection.cid].balances;
	var amount = 0;
	if (b[0].type === subSelection.type) amount = b[0].unconfirmed;
	else if (b[1].type === subSelection.type) amount = b[1].unconfirmed;
	else return false;
	$('#subAmount').val(amount/1e8);
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
	veo.makeBet(text, flag, amount1, amount1 + amount2, expires);
});




$(document).ready(function () {
	if (localStorage.getItem('passphrase')) {
		$('#newAccountLink').hide();
		veo.setKeys(localStorage.getItem('passphrase'));
		$('#pub').text(veo.pub());
		updateBalance();
		balanceUpdater();
		route('send');
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
	}, 10000)
	setInterval(function() {
		balanceUpdater();
		buildPositionsTable()
	}, 10000)
	
	buildBrowseTable()
	buildPositionsTable()
});