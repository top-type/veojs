function buildBrowseTable() {
	veo.trades(function(trades) {
		var res = '<table class="table table-hover"><thead></thead><tbody>';
		trades.forEach(function(trade) {
			var mod1 = trade.type1 == 2 ? '<span class="text-warning">NOT</span> ' : '';
			var mod2 = trade.type2 == 2 ? '<span class="text-warning">NOT</span> ' : '';
			res += '<tr class="table-active" id="' + trade.id+ '">' +
						'<td><span class="text-success">+'+trade.amount1/1e8+'</span></td>' +
						'<td>'+ mod1 + trade.text1.substring(0, 10)+'</td>' +
						'<td><span class="text-danger">-'+trade.amount2/1e8+'</span></td>' +
						'<td>'+ mod2 + trade.text2.substring(0, 10)+'</td>' +
						'</tr>';
		});
		res += '</tbody></table>';
		$('#browse').html(res);
	});
}

function updateBalance() {
	if (!veo.keys()) return;
	veo.balance(function(res) {
		console.log(res);
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
	$('.setClass').hide();
	$('.balance').show();
	$('#pub').text(veo.pub().substring(0,27) + '...');
	updateBalance();
});

function route(r) {
	$('.route').hide();
	$('#'+r).show();
};

$('#walletLink').click(function(e) {
	e.preventDefault();
	console.log('here');
	route('wallet');
});

$('#browseLink').click(function(e) {
	e.preventDefault();
	route('browse');
	buildBrowseTable();
});

$('#createLink').click(function(e) {
	e.preventDefault();
	route('create');
});

$('#forgetLink').click(function(e) {
	e.preventDefault();
	localStorage.removeItem('passphrase');
	veo.forget();
	$('#walletLink').html('');
	$('.setClass').show();
	$('.balance').hide();
	route('browse');
});

$('.navbar-nav>li>a').on('click', function(){
    $('.navbar-collapse').collapse('hide');
});

$('#sendButton').click(function(e) {
	e.preventDefault();
	var recipient = $('#recipient').val();
	var amount = parseFloat($('#amount').val()) * 1e8;
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




$(document).ready(function () {
	if (localStorage.getItem('passphrase')) {
		$('.balance').show();
		veo.setKeys(localStorage.getItem('passphrase'));
		$('#pub').text(veo.pub().substring(0,27) + '...');
		updateBalance();
	}
	else {
		$('.setClass').show();
		veo.forget();
	}
	setInterval(function() {
		updateBalance();
		buildBrowseTable()
	}, 10000)
	
	buildBrowseTable()
	route('browse');
});