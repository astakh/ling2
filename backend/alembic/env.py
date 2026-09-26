from alembic import target_metadata
from models import Base

target_metadata = Base.metadata
