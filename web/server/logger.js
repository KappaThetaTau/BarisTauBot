const chalk = require('chalk');

module.exports = {
	info: msg => {
		console.log(chalk.cyan(`>>> INFO:`), msg);
	},
	err: msg => {
		console.log(chalk.bgYellow.red.bold(`>>> ERROR:`), msg);
	},
	debug: msg => {
		console.log(chalk.bgCyan(`>>> DEBUG:`), msg);
	},
	server: msg => {
		console.log(chalk.bgWhite(`>>> SYSTEM:`), msg);	
	}
};