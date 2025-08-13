#!/usr/bin/env tsx

/**
 * Comprehensive email analysis dashboard
 * Runs all analysis scripts and generates a unified report
 */

import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import chalk from "chalk";

interface AnalysisResult {
  name: string;
  status: "success" | "error";
  summary?: string;
  error?: string;
  duration: number;
}

async function runAnalysis(
  scriptPath: string,
  name: string,
): Promise<AnalysisResult> {
  console.log(chalk.cyan(`\n🔄 Running ${name}...`));
  const startTime = Date.now();

  return new Promise((resolve) => {
    const outputLines: string[] = [];
    const child = spawn("tsx", [scriptPath], {
      stdio: ["inherit", "pipe", "pipe"],
    });

    child.stdout.on("data", (data) => {
      const output = data.toString();
      outputLines.push(output);
      process.stdout.write(output);
    });

    child.stderr.on("data", (data) => {
      const output = data.toString();
      outputLines.push(output);
      process.stderr.write(output);
    });

    child.on("close", (code) => {
      const duration = (Date.now() - startTime) / 1000;

      if (code === 0) {
        // Extract summary from output
        const output = outputLines.join("");
        const summaryMatch = output.match(
          /Summary:|Overall Statistics:|Analysis Summary:/,
        );
        const summary = summaryMatch
          ? output.substring(output.indexOf(summaryMatch[0])).slice(0, 500)
          : "Analysis completed successfully";

        resolve({
          name,
          status: "success",
          summary,
          duration,
        });
      } else {
        resolve({
          name,
          status: "error",
          error: `Process exited with code ${code}`,
          duration,
        });
      }
    });
  });
}

async function generateHTMLReport(results: AnalysisResult[]) {
  const timestamp = new Date().toISOString();
  const reportPath = path.join(
    process.cwd(),
    "data",
    "email-analysis-report.html",
  );

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Analysis Report - ${timestamp}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        h1, h2 {
            color: #2c3e50;
        }
        .header {
            background-color: #3498db;
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            text-align: center;
        }
        .analysis-card {
            background-color: white;
            padding: 25px;
            margin-bottom: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .success {
            border-left: 4px solid #27ae60;
        }
        .error {
            border-left: 4px solid #e74c3c;
        }
        .summary {
            background-color: #ecf0f1;
            padding: 15px;
            border-radius: 5px;
            margin-top: 15px;
            white-space: pre-wrap;
            font-family: 'Courier New', monospace;
            font-size: 14px;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .stat-value {
            font-size: 36px;
            font-weight: bold;
            color: #3498db;
        }
        .stat-label {
            color: #7f8c8d;
            margin-top: 5px;
        }
        .footer {
            text-align: center;
            margin-top: 50px;
            color: #7f8c8d;
        }
        .action-buttons {
            display: flex;
            gap: 15px;
            justify-content: center;
            margin-top: 30px;
        }
        .button {
            padding: 12px 24px;
            border-radius: 5px;
            text-decoration: none;
            color: white;
            font-weight: bold;
            display: inline-block;
        }
        .button-primary {
            background-color: #3498db;
        }
        .button-secondary {
            background-color: #95a5a6;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Email Analysis Dashboard</h1>
        <p>Generated on ${new Date(timestamp).toLocaleString()}</p>
    </div>

    <div class="stats">
        <div class="stat-card">
            <div class="stat-value">${results.length}</div>
            <div class="stat-label">Analyses Run</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${results.filter((r) => r.status === "success").length}</div>
            <div class="stat-label">Successful</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${results.reduce((sum, r) => sum + r.duration, 0).toFixed(1)}s</div>
            <div class="stat-label">Total Duration</div>
        </div>
    </div>

    <h2>Analysis Results</h2>
    ${results
      .map(
        (result) => `
        <div class="analysis-card ${result.status}">
            <h3>${result.name}</h3>
            <p><strong>Status:</strong> ${result.status === "success" ? "✅ Success" : "❌ Error"}</p>
            <p><strong>Duration:</strong> ${result.duration.toFixed(2)} seconds</p>
            ${result.summary ? `<div class="summary">${result.summary}</div>` : ""}
            ${result.error ? `<div class="summary" style="background-color: #ffebee;">${result.error}</div>` : ""}
        </div>
    `,
      )
      .join("")}

    <div class="action-buttons">
        <a href="#" class="button button-primary" onclick="window.location.reload()">Refresh Report</a>
        <a href="#" class="button button-secondary" onclick="window.print()">Print Report</a>
    </div>

    <div class="footer">
        <p>CrewAI Email Analysis System v2.1.0</p>
    </div>
</body>
</html>
  `;

  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, html);

  return reportPath;
}

async function runEmailAnalysisDashboard() {
  console.log(chalk.blue.bold("\n🚀 CrewAI Email Analysis Dashboard\n"));
  console.log(chalk.white("Running comprehensive email analysis suite...\n"));

  const analyses = [
    {
      script: "scripts/analyze-chain-completeness.ts",
      name: "Chain Completeness Analysis",
    },
    {
      script: "scripts/analyze-email-patterns.ts",
      name: "Email Pattern Analysis",
    },
    {
      script: "scripts/analyze-workflow-quality.ts",
      name: "Workflow Quality Analysis",
    },
  ];

  const results: AnalysisResult[] = [];

  // Run analyses sequentially
  for (const analysis of analyses) {
    try {
      const result = await runAnalysis(analysis.script, analysis.name);
      results.push(result);
    } catch (error) {
      results.push({
        name: analysis.name,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        duration: 0,
      });
    }
  }

  // Generate summary
  console.log(chalk.blue.bold("\n\n📊 ANALYSIS SUMMARY\n"));
  console.log(chalk.white("─".repeat(60)));

  const successCount = results.filter((r) => r.status === "success").length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(
    chalk.green(`✅ Successful analyses: ${successCount}/${results.length}`),
  );
  console.log(
    chalk.cyan(`⏱️  Total duration: ${totalDuration.toFixed(1)} seconds`),
  );

  if (successCount < results.length) {
    console.log(chalk.red(`\n❌ Failed analyses:`));
    results
      .filter((r) => r.status === "error")
      .forEach((r) => {
        console.log(chalk.red(`   • ${r.name}: ${r.error}`));
      });
  }

  // Generate HTML report
  try {
    const reportPath = await generateHTMLReport(results);
    console.log(chalk.green(`\n📄 HTML report generated: ${reportPath}`));
    console.log(
      chalk.cyan("   Open in browser: ") + chalk.white(`file://${reportPath}`),
    );
  } catch (error) {
    console.error(chalk.red("\n❌ Failed to generate HTML report:"), error);
  }

  // Next steps
  console.log(chalk.blue.bold("\n\n🚀 NEXT STEPS\n"));
  console.log(chalk.white("─".repeat(60)));
  console.log(chalk.white("1. Review the analysis results above"));
  console.log(
    chalk.white("2. If chain completeness is good (>30%), proceed with:"),
  );
  console.log(chalk.cyan("   npm run pipeline:execute"));
  console.log(chalk.white("3. Monitor real-time progress:"));
  console.log(chalk.cyan("   npm run pipeline:monitor"));
  console.log(chalk.white("4. View dashboard at:"));
  console.log(chalk.cyan("   http://localhost:3001/dashboard"));
}

// Run the dashboard
runEmailAnalysisDashboard()
  .then(() => {
    console.log(chalk.green("\n\n✨ Email analysis dashboard complete!\n"));
    process.exit(0);
  })
  .catch((error) => {
    console.error(chalk.red("\n❌ Fatal error:"), error);
    process.exit(1);
  });
