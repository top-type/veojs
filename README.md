<html>
<body>
<h5>How to set up</h5>
Put veo.js and veo.html in same folder. Open in browser and issue commands from console. <br>

<h5>Examples</h5>
Callbacks are optional. Default is console.log.<br><br>
<b>veo.server("159.89.87.58","8080")</b> <br>
<b>veo.sync()</b> //sync to current height </br>
<b>veo.top()</b> //top header </br>
<b>veo.key("passphrase")</b> //set your account key <br>
<b>veo.pub()</b> <br>
<b>veo.account(callback)</b> //confirmed account state</br>
<b>veo.unconfirmed(callback)</b> </br>
<b>veo.send(amount, to, callback)</b> //amount in satoshis </br>
<b>veo.sweep(to, callback)</b> //send max amount </br>
</body>
</html>
	