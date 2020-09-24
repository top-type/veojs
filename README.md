<html>
<body>
<h6>Usage</h6>

veo.server("159.89.87.58","8080") //set server you talk to
veo.sync() //sync to current height
veo.key("mysecretpassphrase") //set your account key (be careful xD)
veo.pub() //public key
veo.account(callback) //confirmed account state, add callback to do stuff (console.log default) 
veo.unconfirmed(callback) //unconfirmed account state
veo.send(amount, to, callback)
</body>
</html>
	