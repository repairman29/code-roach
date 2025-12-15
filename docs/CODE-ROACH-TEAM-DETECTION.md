# Code Roach Team Detection & Analysis

## Overview

Beyond pairs, Code Roach can detect and leverage **teams** of 3+ super workers that work together effectively. Teams provide comprehensive coverage and specialized expertise.

---

## 🚀 Quick Start

### Detect Teams

```bash
npm run code-roach:detect-teams
```

This will:
1. Analyze all super workers
2. Detect effective teams (3-5 workers)
3. Identify team specializations
4. Absorb team knowledge into Code Roach

---

## 👥 Team Detection

### How Teams Are Detected

Teams are identified based on:

1. **Coverage**: How many categories/file types the team covers
2. **Complementarity**: How well workers complement each other
3. **Specialization**: Whether the team has a clear focus area
4. **Team Score**: Combined metric (threshold: 60%+)

### Team Sizes

- **3 workers**: Small, focused teams
- **4 workers**: Medium teams with good coverage
- **5 workers**: Large teams with comprehensive coverage

---

## 🎯 Team Specializations

### Auto-Detected Specializations

- **Frontend**: UI, CSS, HTML, JavaScript
- **Backend**: API, server, database
- **Testing**: Test files and testing patterns
- **Security**: Security and authentication
- **Performance**: Performance optimization
- **Documentation**: Docs and markdown
- **Full-Stack**: General purpose, all areas

### Specialization Detection

Teams are matched to specializations based on:
- Category expertise overlap
- File type coverage
- Worker strengths alignment

---

## 📊 Team Knowledge

### What Gets Created

For each detected team:

1. **Team Overview**: Composition, specialization, score
2. **Coverage Analysis**: Categories and file types covered
3. **Complementarity Metrics**: How well workers work together
4. **Specialization Knowledge**: Best team for each specialization

### Example Team Knowledge

```
Super Worker Team: Frontend Team (1, 2, 3)

Team Composition: 3 workers (1, 2, 3)
Specialization: frontend
Team Score: 78.5%

Coverage:
- Categories: 8 (ui, css, html, javascript, ...)
- File Types: 5 (.html, .css, .js, ...)

Complementarity: 65.2%
Category Coverage: 85.0%
File Type Coverage: 90.0%
```

---

## 🔧 Customization

### Add Custom Specializations

Edit `scripts/detect-super-worker-teams.js`:

```javascript
const TEAM_SPECIALIZATIONS = {
    'your-spec': {
        categories: ['category1', 'category2'],
        fileTypes: ['.js', '.ts'],
        paths: ['optional/path/']
    }
};
```

### Adjust Team Detection Threshold

```javascript
if (teamScore.totalScore > 0.6) { // Lower = more teams, Higher = fewer teams
```

### Limit Team Sizes

```javascript
for (let teamSize = 3; teamSize <= Math.min(5, workers.length); teamSize++) {
    // Change 5 to desired max team size
}
```

---

## 📈 Team Benefits

### For Code Roach

- **Comprehensive Coverage**: Teams cover more categories/file types
- **Specialized Expertise**: Best team for specific task types
- **Higher Confidence**: Combined experience increases confidence
- **Better Matching**: Match issues to specialized teams

### For Development

- **Targeted Fixes**: Use specialized teams for specific areas
- **Comprehensive Solutions**: Teams provide complete coverage
- **Efficient Processing**: Right team for the right job
- **Scalable Knowledge**: Team knowledge scales with team size

---

## 🎯 Usage Examples

### Detect Teams

```bash
npm run code-roach:detect-teams
```

### Output Example

```
🔍 Detecting Super Worker Teams...

📊 Loaded 35 workers

👥 Detected 12 teams

🏆 Top Teams:
   1. Frontend Team (1, 2, 3)
      Score: 78.5% | Specialization: frontend
      Workers: 1, 2, 3

   2. Backend Team (4, 5, 6)
      Score: 72.3% | Specialization: backend
      Workers: 4, 5, 6

   3. Full-Stack Team (7, 8, 9, 10)
      Score: 68.1% | Specialization: full-stack
      Workers: 7, 8, 9, 10

📚 Absorbing team knowledge...

✅ Team Detection Complete!
   Teams Detected: 12
   Team Knowledge Added: 12
   Specializations Found: 5
```

---

## 🔄 Integration with Code Roach

### How Code Roach Uses Teams

1. **Issue Matching**: Match issues to specialized teams
2. **Team Selection**: Choose best team for task type
3. **Combined Knowledge**: Use team's combined expertise
4. **Specialization Routing**: Route to specialized teams

### Team-Based Fixing

When Code Roach encounters an issue:
1. Identify issue category/type
2. Find matching team specialization
3. Use team's combined knowledge
4. Apply team's proven patterns

---

## 📊 Team Analytics

### Team Metrics

- **Team Score**: Overall effectiveness (0-1)
- **Coverage**: Categories/file types covered
- **Complementarity**: How well workers complement
- **Specialization**: Team's focus area

### Specialization Metrics

- **Best Team**: Highest scoring team per specialization
- **Available Workers**: Workers in specialization
- **Team Count**: Number of teams per specialization

---

## 🎓 Best Practices

### Team Formation

1. **Diverse Skills**: Teams should have complementary skills
2. **Clear Focus**: Specialized teams perform better
3. **Right Size**: 3-5 workers is optimal
4. **Coverage**: Teams should cover multiple categories

### Using Teams

1. **Match Specialization**: Use specialized teams for specific tasks
2. **Leverage Coverage**: Use full-stack teams for general tasks
3. **Combine Knowledge**: Teams provide combined expertise
4. **Track Performance**: Monitor team effectiveness

---

## 🔍 Advanced Features

### Team Workflows

Teams can have defined workflows:
- **Sequential**: Workers handle tasks in order
- **Parallel**: Workers work simultaneously
- **Collaborative**: Workers share knowledge

### Team Handoffs

Teams can hand off tasks:
- **Specialization Handoff**: Pass to specialized team
- **Complexity Handoff**: Pass complex tasks to expert teams
- **Coverage Handoff**: Pass to teams with better coverage

---

## 📚 Related Documentation

- [Super Worker Integration](./CODE-ROACH-SUPER-WORKER-INTEGRATION.md)
- [Batch Review Guide](./CODE-ROACH-BATCH-REVIEW-GUIDE.md)
- [Knowledge Base System](./SPRINT-2-COMPLETE.md)

---

## 🎉 Summary

**Team Detection:**
1. Run `npm run code-roach:detect-teams`
2. Teams are detected and analyzed
3. Team knowledge is absorbed
4. Code Roach uses teams automatically

**Key Benefits:**
- Comprehensive coverage
- Specialized expertise
- Better matching
- Scalable knowledge

---

**Teams + Pairs + Individuals = Complete Code Quality Coverage!** 🪳👥⚡
