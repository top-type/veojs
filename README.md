<html>
<body>
<h6>Usage</h6>

veo.server("159.89.87.58","8080") //set server you talk to <br>
veo.sync() //sync to current height </br>
veo.key("mysecretpassphrase") //set your account key (be careful) <br>
veo.pub() //public key c
veo.account(callback) //confirmed account state, add callback to do stuff (console.log default) </br>
veo.unconfirmed(callback) //unconfirmed account state </br>
veo.send(amount, to, callback) </br>
</body>
</html>
	