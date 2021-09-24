function buildBetsTable() {
	veo.trades(function(trades) {
		var res = '<table class="table table-hover"><thead>'+
		'<tr>'+
		'<th colspan="2"><span class="text-muted">Gain</span></th>'+
		'<th colspan="2"><span class="text-muted">Lose</span></th>'+
		'</tr>'+
		'</thead><tbody>';
		trades.forEach(function(trade) {
			var mod1 = trade.type1 == 2 ? 'NOT ' : '';
			var mod2 = trade.type2 == 2 ? 'NOT ' : '';
			res += '<tr class="table-active" id="' + trade.id+ '">' +
						'<td><span class="text-success">+'+trade.amount1/1e8+'</span></td>' +
						'<td>'+ mod1 + trade.text1.substring(0, 10)+'</td>' +
						'<td><span class="text-danger">-'+trade.amount2/1e8+'</span></td>' +
						'<td>'+ mod2 + trade.text2.substring(0, 10)+'</td>' +
						'</tr>';
		});
		res += '</tbody></table>';
		$('#bets').html(res);
	});
}

function updateBalance() {
	veo.balance(function(res) {
		console.log(res);
		var html = veo.pub().substring(0,5) + ': ' + res.confirmed/1e8
		var u = (res.unconfirmed - res.confirmed)/1e8;
		if (u > 0) {
			html += ' <span class="text-success">(+'+u+')</span>';
		}
		if (u < 0) {
			html += ' <span class="text-danger">(+'+u+')</span>';
		}
		$('#balance').html(html);
	})
};

$('#setButton').click(function(e) {
	e.preventDefault();
	console.log('here');
	var passphrase = $('#passphrase').val();
	localStorage.setItem('passphrase', passphrase);
	veo.setKeys(passphrase);
	$('.setClass').hide();
	$('.balance').show()
	updateBalance();
});


function route(r) {
	$('.route').hide();
	$('#'+r).show();
};

$(document).ready(function () {
	if (localStorage.getItem('passphrase')) {
		$('.balance').show();
		veo.setKeys(localStorage.getItem('passphrase'));
		updateBalance();
	}
	else {
		$('.setClass').show();
	}
	
});