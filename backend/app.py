import logging
from flask import Flask, jsonify
from flask_cors import CORS
from config import Config
from database import init_db
from routes import api_bp

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("backend")

def create_app():
    """Application Factory Pattern."""
    app = Flask(__name__)
    app.config.from_object(Config)

    # Enable CORS for Mobile App and Web dashboard requests
    CORS(app)

    # Register API Blueprint
    app.register_blueprint(api_bp)

    # Initialize Database & Seed Demo Data
    with app.app_context():
        init_db()

    # Global Error Handlers
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({"success": False, "error": "Endpoint not found"}), 404

    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({"success": False, "error": "Internal server error"}), 500

    return app

app = create_app()

if __name__ == "__main__":
    logger.info(f"Starting AI Driving Safety System Backend on http://{Config.HOST}:{Config.PORT}")
    app.run(host=Config.HOST, port=Config.PORT, debug=Config.DEBUG)
