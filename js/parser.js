// YAML/JSON parser and validator for game configuration files

const Parser = {
  // Parse file content (auto-detect YAML or JSON)
  parse(fileContent, filename) {
    try {
      // Try JSON first
      if (filename.endsWith('.json')) {
        return this.parseJSON(fileContent);
      }
      // Try YAML
      else if (filename.endsWith('.yaml') || filename.endsWith('.yml')) {
        return this.parseYAML(fileContent);
      }
      // Auto-detect
      else {
        try {
          return this.parseJSON(fileContent);
        } catch (e) {
          return this.parseYAML(fileContent);
        }
      }
    } catch (error) {
      throw new Error(`Parse error: ${error.message}`);
    }
  },

  // Parse JSON
  parseJSON(content) {
    try {
      const config = JSON.parse(content);
      return this.validate(config);
    } catch (error) {
      throw new Error(`Invalid JSON: ${error.message}`);
    }
  },

  // Parse YAML (requires js-yaml library)
  parseYAML(content) {
    if (typeof jsyaml === 'undefined') {
      throw new Error('YAML parser not loaded. Please include js-yaml library.');
    }
    try {
      const config = jsyaml.load(content);
      return this.validate(config);
    } catch (error) {
      throw new Error(`Invalid YAML: ${error.message}`);
    }
  },

  // Validate game configuration (lenient - allows partial games)
  validate(config) {
    const errors = [];
    const warnings = [];

    // Check title - provide default if missing
    if (!config.title || typeof config.title !== 'string') {
      config.title = 'Untitled Game';
      warnings.push('No title provided, using "Untitled Game"');
    }

    // Check categories
    if (!config.categories || !Array.isArray(config.categories)) {
      errors.push('Missing or invalid "categories" array');
    } else {
      if (config.categories.length < 1) {
        errors.push('Must have at least 1 category');
      }
      if (config.categories.length > 6) {
        errors.push('Cannot have more than 6 categories');
      }

      // Validate each category
      config.categories.forEach((category, catIndex) => {
        // Provide default category name if missing
        if (!category.name || typeof category.name !== 'string') {
          category.name = `Category ${catIndex + 1}`;
          warnings.push(`Category ${catIndex + 1}: No name provided, using default`);
        }

        // Check questions array exists
        if (!category.questions || !Array.isArray(category.questions)) {
          category.questions = [];
          warnings.push(`Category ${catIndex + 1}: No questions array, creating empty array`);
        }

        // Validate each question (very lenient)
        category.questions.forEach((question, qIndex) => {
          // Ensure value exists and is a number
          if (typeof question.value !== 'number') {
            question.value = (qIndex + 1) * 200; // Default point value
            warnings.push(`Category ${catIndex + 1}, Question ${qIndex + 1}: No value provided, using ${question.value}`);
          }

          // Allow empty questions and answers
          if (question.question === undefined || question.question === null) {
            question.question = '';
          }
          if (typeof question.question !== 'string') {
            question.question = String(question.question);
          }

          if (question.answer === undefined || question.answer === null) {
            question.answer = '';
          }
          if (typeof question.answer !== 'string') {
            question.answer = String(question.answer);
          }

          // Ensure dailyDouble is boolean if present
          if (question.dailyDouble !== undefined && typeof question.dailyDouble !== 'boolean') {
            question.dailyDouble = Boolean(question.dailyDouble);
          }

          // Validate image URL if present (optional)
          if (question.image !== undefined && question.image !== null) {
            if (typeof question.image !== 'string') {
              question.image = String(question.image);
            }
            // Basic URL validation
            const urlPattern = /^(https?:\/\/|data:(image|video)\/)/i;
            if (!urlPattern.test(question.image)) {
              warnings.push(`Category ${catIndex + 1}, Question ${qIndex + 1}: Image/video URL should start with http://, https://, data:image/, or data:video/`);
            }
          }
        });
      });
    }

    // Validate settings if present (lenient)
    if (config.settings) {
      if (config.settings.pointValues && !Array.isArray(config.settings.pointValues)) {
        delete config.settings.pointValues;
        warnings.push('Settings: "pointValues" was invalid, removed');
      }
      if (config.settings.timerSeconds && typeof config.settings.timerSeconds !== 'number') {
        delete config.settings.timerSeconds;
        warnings.push('Settings: "timerSeconds" was invalid, removed');
      }
    }

    // Validate Final Jeopardy if present (optional, backwards compatible)
    if (config.finalJeopardy) {
      // Ensure category exists
      if (!config.finalJeopardy.category || typeof config.finalJeopardy.category !== 'string') {
        config.finalJeopardy.category = 'Final Jeopardy';
        warnings.push('Final Jeopardy: No category provided, using default');
      }

      // Allow empty question and answer (can fill in later)
      if (config.finalJeopardy.question === undefined || config.finalJeopardy.question === null) {
        config.finalJeopardy.question = '';
      }
      if (typeof config.finalJeopardy.question !== 'string') {
        config.finalJeopardy.question = String(config.finalJeopardy.question);
      }

      if (config.finalJeopardy.answer === undefined || config.finalJeopardy.answer === null) {
        config.finalJeopardy.answer = '';
      }
      if (typeof config.finalJeopardy.answer !== 'string') {
        config.finalJeopardy.answer = String(config.finalJeopardy.answer);
      }
    }

    // Validate theme if present (optional, backwards compatible)
    if (config.theme) {
      // Can be a preset name (string) or custom colors (object)
      if (typeof config.theme === 'string') {
        // Preset theme name - will be validated when applied
        config.theme = { preset: config.theme };
      } else if (typeof config.theme === 'object') {
        // Custom theme colors - validate hex color format
        const colorFields = ['boardColor', 'questionColor', 'textColor', 'accentColor', 'backgroundColor'];
        colorFields.forEach(field => {
          if (config.theme[field] && typeof config.theme[field] === 'string') {
            // Basic hex color validation
            if (!/^#[0-9A-Fa-f]{6}$/.test(config.theme[field])) {
              warnings.push(`Theme: "${field}" has invalid hex color format, ignoring`);
              delete config.theme[field];
            }
          }
        });
      } else {
        warnings.push('Theme: Invalid format, ignoring');
        delete config.theme;
      }
    }

    // Only throw errors for critical issues
    if (errors.length > 0) {
      throw new Error('Validation errors:\n' + errors.join('\n'));
    }

    // Log warnings to console
    if (warnings.length > 0) {
      console.warn('Validation warnings:', warnings);
    }

    return config;
  },

  // Read file as text
  async readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  },

  // Parse uploaded file
  async parseFile(file) {
    try {
      const content = await this.readFile(file);
      const config = this.parse(content, file.name);
      return { success: true, config: config };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};
