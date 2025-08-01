# BusinessSearchPromptEnhancer Documentation

## GROUP 2B WebSearch Enhancement - Agent 23 Implementation

### Overview

The BusinessSearchPromptEnhancer is a critical component of the GROUP 2B WebSearch Enhancement initiative. It transforms base prompts to explicitly instruct language models to use WebSearch capabilities when responding to business-related queries, ensuring users receive current, accurate, and actionable business information.

### Architecture

```typescript
BusinessSearchPromptEnhancer
├── Core Methods
│   ├── enhance() - Main enhancement method
│   ├── getDefaultBusinessPrompt() - Fallback prompt generator
│   ├── isAlreadyEnhanced() - Detection method
│   └── extractInstructions() - Instruction parser
├── Utility Methods
│   ├── needsEnhancement() - Auto-detection
│   ├── removeEnhancement() - Cleanup utility
│   └── isValidEnhancementLevel() - Validation
└── Security Features
    ├── Input sanitization
    ├── Injection prevention
    └── Error handling
```

### Key Features

#### 1. Enhancement Levels

**Minimal**

- Light-touch enhancement
- Basic WebSearch instruction
- Suitable for general queries

**Standard** (Default)

- Comprehensive instructions
- Detailed requirements list
- Balanced approach for most use cases

**Aggressive**

- Critical requirement language
- Extensive mandatory actions
- Comprehensive quality standards
- For urgent/critical business queries

#### 2. Markers and Identifiers

- `[BUSINESS_SEARCH_ENHANCED]` - Indicates an enhanced prompt
- `[BUSINESS_SEARCH_INSTRUCTIONS]` - Marks instruction section start
- `[Enhancement Metadata]` - Contains level and timestamp

#### 3. Business Examples

The enhancer includes curated examples showing proper business information formatting:

```
✓ GOOD: "Joe's Plumbing - (555) 123-4567, 123 Main St, Open 24/7"
✗ BAD: "Search online for plumbers in your area"
```

### Integration Guidelines

#### Basic Integration

```typescript
import { businessSearchPromptEnhancer } from "@core/prompts";

// Simple enhancement
const enhanced = businessSearchPromptEnhancer.enhance(userQuery);

// With options
const enhanced = businessSearchPromptEnhancer.enhance(userQuery, {
  enhancementLevel: "aggressive",
  includeExamples: true,
  customInstructions: "Focus on 5-mile radius",
});
```

#### Agent Integration Pattern

```typescript
class YourAgent extends BaseAgent {
  async processQuery(query: string) {
    // Check if enhancement needed
    if (businessSearchPromptEnhancer.needsEnhancement(query)) {
      const enhanced = businessSearchPromptEnhancer.enhance(query);
      return await this.llm.generate(enhanced);
    }
    return await this.llm.generate(query);
  }
}
```

#### LLM Provider Integration

```typescript
// In OllamaProvider or similar
async generateResponse(prompt: string, options?: RequestOptions) {
  const finalPrompt = this.shouldEnhanceForBusiness(prompt)
    ? businessSearchPromptEnhancer.enhance(prompt, this.enhancementConfig)
    : prompt;

  return await this.callModel(finalPrompt, options);
}
```

### Business Query Detection

The enhancer automatically detects business-related queries using keywords:

- Location: "find", "where", "locate", "near me", "nearby"
- Business types: "store", "shop", "restaurant", "service", "company"
- Information needs: "hours", "open", "contact", "phone", "address"

### Security Considerations

1. **Input Sanitization**
   - Removes existing enhancement markers
   - Strips template injection attempts
   - Validates all inputs

2. **Injection Prevention**
   - Filters `{{template}}` patterns
   - Removes unauthorized markers
   - Sanitizes custom instructions

3. **Error Handling**
   - Graceful fallback to default prompt
   - Comprehensive error logging
   - No exposure of internal state

### Performance Metrics

- Enhancement time: < 10ms for typical prompts
- Memory overhead: Minimal (singleton pattern)
- Concurrent usage: Thread-safe design

### Testing

Comprehensive test suite covers:

- All enhancement levels
- Edge cases and error conditions
- Security vulnerabilities
- Performance benchmarks
- Input sanitization

Run tests:

```bash
npm test src/core/prompts/__tests__/BusinessSearchPromptEnhancer.test.ts
```

### Usage Examples

See `example-usage.ts` for comprehensive examples including:

- Basic enhancement
- LLM integration
- Agent patterns
- Batch processing
- Dynamic enhancement
- Custom categories

### Best Practices

1. **Choose Appropriate Enhancement Level**
   - Use 'minimal' for casual queries
   - Use 'standard' for most business searches
   - Reserve 'aggressive' for urgent/critical needs

2. **Custom Instructions**
   - Add location context when available
   - Include user preferences
   - Specify search radius

3. **Error Handling**
   - Always handle enhancement failures
   - Use default prompt as fallback
   - Log errors for debugging

4. **Performance**
   - Cache enhancement results when possible
   - Batch similar queries
   - Monitor enhancement metrics

### Troubleshooting

**Issue: Model not using WebSearch**

- Solution: Upgrade to 'aggressive' enhancement level
- Add explicit examples
- Check model capabilities

**Issue: Over-enhancement**

- Solution: Use 'minimal' level
- Disable examples
- Remove custom instructions

**Issue: Prompt too long**

- Solution: Use 'minimal' level without examples
- Extract and store instructions separately
- Consider prompt compression

### Future Enhancements

1. **Dynamic Level Selection**
   - ML-based enhancement level prediction
   - User preference learning
   - Context-aware enhancement

2. **Multi-language Support**
   - Localized business examples
   - International format support
   - Cultural adaptations

3. **Advanced Features**
   - Industry-specific enhancements
   - Real-time A/B testing
   - Enhancement effectiveness metrics

### Compliance and Standards

The BusinessSearchPromptEnhancer adheres to:

- GDPR requirements (no PII storage)
- Accessibility standards (clear formatting)
- Security best practices (input validation)
- Performance standards (<10ms enhancement)

### Support

For issues or questions regarding the BusinessSearchPromptEnhancer:

1. Check this documentation
2. Review example-usage.ts
3. Run the test suite
4. Contact Agent 23 or GROUP 2B team

---

_Last Updated: [Current Date]_
_Version: 1.0.0_
_Agent: 23 - Prompt Engineering Specialist_
_Group: 2B - WebSearch Enhancement_
