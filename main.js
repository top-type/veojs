function buildTradeTable() {
	veo.trades(function(trades) {
		var res = '<table class="table table-hover">' +
		'<thead><tr><th scope="col">C1</th><th scope="col">A1</th>' +
		'<th scope="col">C2 </th><th scope="col">A2</th></tr></thead><tbody>';
		trades.forEach(function(trade) {
			var mod1 = trade.type1 == 2 ? 'NOT ' : '';
			var mod2 = trade.type2 == 2 ? 'NOT ' : '';
			res += '<tr class="table-active" id="' + trade.id+ '">' +
						'<td>'+ mod1 + trade.text1.substring(0, 10)+'</td>' +
						'<td>'+trade.amount1/1e8+'</td>' +
						'<td>'+ mod2 + trade.text2.substring(0, 10)+'</td>' +
						'<td>'+trade.amount2/1e8+'</td>' +
						'</tr>';
		});
		res += '</tbody></table>';
		$('body').append(res);
	});
}