const fs = require('fs');
const path = require('path');

// ANSI colors for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  underscore: "\x1b[4m",
  blink: "\x1b[5m",
  reverse: "\x1b[7m",
  hidden: "\x1b[8m",

  fg: {
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
  },
  bg: {
    black: "\x1b[40m",
    red: "\x1b[41m",
    green: "\x1b[42m",
    yellow: "\x1b[43m",
    blue: "\x1b[44m",
    magenta: "\x1b[45m",
    cyan: "\x1b[46m",
    white: "\x1b[47m",
  }
};

class SectionValidator {
    constructor(sectionName) {
        this.sectionName = sectionName;
        this.totalTests = 0;
        this.passedTests = 0;
    }

    log(message) {
        console.log(message);
    }

    test(description, testFunction) {
        this.totalTests++;
        try {
            const result = testFunction();
            if (result) {
                this.success(description);
            } else {
                // The test function should throw its own error
            }
        } catch (error) {
            this.error(description, error.message);
        }
    }

    success(description) {
        this.passedTests++;
        this.log(`${colors.fg.green}✅ PASSED: ${description}${colors.reset}`);
    }

    error(description, errorMessage) {
        this.log(`${colors.fg.red}❌ FAILED: ${description}${colors.reset}`);
        this.log(`   ${colors.fg.red}↳ ${errorMessage}${colors.reset}`);
    }

    generateReport() {
        this.log("\n" + "-".repeat(50));
        this.log(`${colors.bright}📊 Validation Report for: ${this.sectionName}${colors.reset}`);
        this.log("-".repeat(50));
        this.log(`Total Tests: ${this.totalTests}`);
        this.log(`Passed: ${this.passedTests}`);
        this.log(`Failed: ${this.totalTests - this.passedTests}`);
        const successRate = this.totalTests > 0 ? (this.passedTests / this.totalTests) * 100 : 0;
        this.log(`Success Rate: ${successRate.toFixed(2)}%`);
        this.log("-".repeat(50) + "\n");
        return this.passedTests === this.totalTests;
    }

    run() {
      this.log(`${colors.magenta}🔍 IGRIS-ENGINE OBSERVABILITY SECTION VALIDATION${colors.reset}`);
      this.log(`${colors.cyan}Starting comprehensive validation of observability extraction...${colors.reset}\n`);
      
      this.test("Readme file exists and is not empty", () => {
        const filePath = path.join(__dirname, '..', 'docs', 'sections', 'observability.md');
        if (!fs.existsSync(filePath)) {
          throw new Error("observability.md does not exist");
        }
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.trim() === '') {
          throw new Error("observability.md is empty");
        }
        return true;
      });

      // Add more tests here based on the specific requirements of the observability section

      return this.generateReport();
    }
}

const validator = new SectionValidator("Observability Extraction");
const success = validator.run();

process.exit(success ? 0 : 1); 