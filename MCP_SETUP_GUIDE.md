# MCP (Model Context Protocol) Setup Guide for Claude Code

## Configuration Location

The MCP configuration must be placed at:
```
~/.config/Claude/claude_desktop_config.json
```

## Configuration Status

✅ Configuration has been copied to the correct location.

## Available MCP Servers

1. **wslFilesystem** - File system access via WSL
2. **zDriveFilesystem** - File system access for Z: drive
3. **vectorize** - Vectorize.io integration
4. **memory** - Knowledge graph memory server
5. **playwright** - Browser automation
6. **claude-code-mcp** - Claude Code specific MCP
7. **fetch** - HTTP fetch capabilities
8. **Bright Data** - Web scraping service
9. **supabase** - Supabase database access
10. **youtube-transcript** - YouTube transcript extraction
11. **mastra** - Documentation server
12. **puppeteer** - Browser automation
13. **sequential** - Sequential thinking server
14. **magic** - Magic server
15. **redis** - Redis database access
16. **gdrive** - Google Drive access
17. **context7** - Context7 integration

## Using MCP in Claude Code

To use MCP servers in Claude Code, you need to:

1. **Restart Claude Desktop** after configuration changes
2. Use the `/mcp` command in Claude Code to interact with MCP servers
3. The servers will be available in the MCP tools dropdown

## Troubleshooting

### If MCP servers don't appear:

1. **Check configuration location**:
   ```bash
   ls -la ~/.config/Claude/claude_desktop_config.json
   ```

2. **Verify npx is available**:
   ```bash
   which npx
   ```

3. **Test a server manually**:
   ```bash
   npx -y @modelcontextprotocol/server-memory --help
   ```

4. **Check for errors in Claude Desktop**:
   - Look for error messages in the Claude Desktop console
   - Restart Claude Desktop completely

### Common Issues:

- **WSL-based servers**: Only work on Windows with WSL installed
- **Path issues**: Ensure all paths in the config are absolute
- **Permission issues**: Make sure the config file is readable
- **Node/npm issues**: Ensure Node.js and npm are properly installed

## Next Steps

1. Restart Claude Desktop to load the new configuration
2. In Claude Code, the MCP servers should now be available
3. You can use tools from any configured MCP server

Note: The `/mcp` command is a Claude Desktop feature, not a Claude Code CLI command. MCP servers provide additional tools and capabilities that appear in the tools dropdown in Claude Desktop.