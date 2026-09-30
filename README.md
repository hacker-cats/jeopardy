
# Jeopardy Game

A fully-featured Jeopardy-style game for static deployment on GitHub Pages. No backend required!

## Features

- Upload YAML or JSON game configuration files
- Multiple game management (create, resume, delete)
- Team tracking with customizable names and colors
- Undo/Redo functionality with full history tracking
- Daily Double support with wager system
- Syntax-highlighted code blocks, embedded images/videos (incl. YouTube), and clickable links in questions and answers (see docs.html)
- Persistent game state using localStorage
- Responsive design for mobile and desktop
- Customizable settings (timer, sound, scoring rules)

## Getting Started

### Quick Start

1. Open `index.html` in your web browser
2. Click "Create New Game"
3. Upload a YAML or JSON game file (see `examples/sample-game.yaml`)
4. Start playing!

### Deploying to GitHub Pages

1. Push this repository to GitHub
2. Go to repository Settings → Pages
3. Select your branch (usually `main`) as the source
4. Your game will be available at `https://yourusername.github.io/repository-name`

## Creating Game Files

Game files can be in YAML or JSON format. Here's the structure:

### YAML Format

```yaml
title: "Your Game Title"

categories:
  - name: "Category Name"
    questions:
      - value: 200
        question: "Question text"
        answer: "Answer text"
      - value: 400
        question: "Another question"
        answer: "Another answer"
        dailyDouble: true  # Optional: marks as Daily Double
      # ... more questions

  - name: "Another Category"
    questions:
      # ... questions

# Optional settings
settings:
  pointValues: [200, 400, 600, 800, 1000]
  doubleJeopardy: false
  allowNegativeScores: true
  timerSeconds: 30
```

### JSON Format

```json
{
  "title": "Your Game Title",
  "categories": [
    {
      "name": "Category Name",
      "questions": [
        {
          "value": 200,
          "question": "Question text",
          "answer": "Answer text"
        },
        {
          "value": 400,
          "question": "Another question",
          "answer": "Another answer",
          "dailyDouble": true
        }
      ]
    }
  ],
  "settings": {
    "pointValues": [200, 400, 600, 800, 1000],
    "doubleJeopardy": false,
    "allowNegativeScores": true,
    "timerSeconds": 30
  }
}
```

## Game Configuration

### Required Fields

- `title`: Game title (string)
- `categories`: Array of category objects
  - `name`: Category name (string)
  - `questions`: Array of question objects
    - `value`: Point value (number)
    - `question`: Question text (string)
    - `answer`: Answer text (string)

### Optional Fields

- `dailyDouble`: Mark a question as Daily Double (boolean)
- `settings`: Game settings object
  - `pointValues`: Default point values (array of numbers)
  - `doubleJeopardy`: Double all point values (boolean)
  - `allowNegativeScores`: Allow teams to go negative (boolean)
  - `timerSeconds`: Answer timer duration (number)

## Playing the Game

### Overview Page

- View all your games
- See game progress and team scores
- Resume in-progress games
- Delete games you no longer need

### Game Board

- Click question tiles to reveal questions
- Select which team is answering
- Reveal answers and judge correct/incorrect
- Use undo/redo to fix mistakes

### Daily Double

When you hit a Daily Double:
1. The game prompts for a wager
2. Minimum wager: $5
3. Maximum wager: Your current score OR the highest question value (whichever is greater)
4. Only the selecting team can answer
5. Correct adds the wager, incorrect subtracts it

### Menu Options

**Teams:**
- Add/remove teams (1-6 teams supported)
- Edit team names and colors
- View current scores

**Settings:**
- Enable/disable answer timer
- Toggle sound effects
- Auto-show answers or require reveal
- Allow/disallow negative scores

**History:**
- View all actions taken in the game
- See current position in history
- Undo/redo uses this history

## Undo/Redo System

Every action is tracked:
- Answering questions (correct/incorrect)
- Daily Double wagers and results
- Team additions/removals
- Team edits
- Score adjustments

Use the ↶ and ↷ buttons to undo/redo any action. The game state will be restored to that exact point in time.

## Browser Compatibility

Works in all modern browsers:
- Chrome/Edge (recommended)
- Firefox
- Safari
- Mobile browsers

Requires localStorage support (available in all modern browsers).

## Storage

Games are stored in your browser's localStorage. Each browser/device maintains its own storage, so games won't sync across devices automatically.

**Storage Limits:**
- Typical limit: 5-10MB
- The app tracks storage usage
- You can delete old games to free up space

## Tips

- Create multiple game boards for different topics
- Use descriptive category names
- Keep questions clear and concise
- Test your game file before playing with others
- Use the sample game as a template
- Take advantage of undo/redo for mistakes

## File Structure

```
/
├── index.html              # Overview/management page
├── game.html               # Game board page
├── css/
│   ├── main.css           # Global styles
│   ├── overview.css       # Overview page styles
│   └── game.css           # Game board styles
├── js/
│   ├── storage.js         # localStorage wrapper
│   ├── gameState.js       # Game state management
│   ├── history.js         # Undo/redo system
│   ├── parser.js          # YAML/JSON parser
│   ├── overview.js        # Overview page logic
│   └── game.js            # Game board logic
├── lib/
│   └── js-yaml.min.js     # YAML parsing library
├── examples/
│   └── sample-game.yaml   # Example game file
└── README.md              # This file
```

## Customization

Want to customize the appearance?

- Edit `css/main.css` for global styles
- Edit `css/game.css` for game board colors and layout
- Modify CSS variables at the top of `main.css`:
  - `--jeopardy-blue`: Question tile background
  - `--jeopardy-gold`: Category headers and accents
  - Other color variables for your theme

## Troubleshooting

**Game file won't upload:**
- Check that your file is valid YAML or JSON
- Ensure all required fields are present
- Look at the error message for specific issues
- Compare with the sample game file

**Game state not saving:**
- Check that localStorage is enabled in your browser
- Check if you've hit storage limits
- Try deleting old games

**Questions not appearing:**
- Verify your categories have questions arrays
- Check that question values are numbers
- Ensure question and answer fields are strings

## Contributing

Feel free to fork and enhance this project! Some ideas:
- Final Jeopardy round
- Sound effects and animations
- Theme customization UI
- Export/import game states
- Multiplayer over network

## License

This project is open source and available for personal and educational use.

## Credits

Built with vanilla JavaScript, HTML, and CSS. Uses [js-yaml](https://github.com/nodeca/js-yaml) for YAML parsing.

Enjoy your game!
