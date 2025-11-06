# backend/services/rag_service.py - RAG (Retrieval Augmented Generation) Service
import os
import pickle
import numpy as np
from typing import List, Dict, Tuple
import re

# Try to import vector store dependencies
try:
    import faiss
    from sentence_transformers import SentenceTransformer
    EMBEDDINGS_AVAILABLE = True
    print("✅ RAG dependencies loaded successfully")
except ImportError as e:
    print(f"⚠️ RAG dependencies not available: {e}")
    EMBEDDINGS_AVAILABLE = False
    
class RAGService:
    def __init__(self):
        self.embeddings_available = EMBEDDINGS_AVAILABLE
        self.model = None
        self.vector_store_dir = 'vector_stores'
        
        if EMBEDDINGS_AVAILABLE:
            try:
                # Use a lightweight model for embeddings
                self.model = SentenceTransformer('all-MiniLM-L6-v2')
                os.makedirs(self.vector_store_dir, exist_ok=True)
                print("✅ RAG Service initialized with embeddings model")
            except Exception as e:
                print(f"⚠️ Could not load embeddings model: {e}")
                self.embeddings_available = False
    
    def chunk_text(self, text: str, chunk_size: int = 500, overlap: int = 50) -> List[Dict]:
        """
        Split text into overlapping chunks for better context preservation
        """
        # Clean text
        text = re.sub(r'\s+', ' ', text).strip()
        
        # Split into sentences
        sentences = re.split(r'[.!?]+', text)
        sentences = [s.strip() for s in sentences if len(s.strip()) > 10]
        
        chunks = []
        current_chunk = []
        current_length = 0
        
        for sentence in sentences:
            sentence_length = len(sentence)
            
            # If adding this sentence exceeds chunk_size, save current chunk
            if current_length + sentence_length > chunk_size and current_chunk:
                chunk_text = '. '.join(current_chunk) + '.'
                chunks.append({
                    'text': chunk_text,
                    'length': len(chunk_text)
                })
                
                # Keep last sentence for overlap
                if overlap > 0 and len(current_chunk) > 0:
                    current_chunk = [current_chunk[-1]]
                    current_length = len(current_chunk[0])
                else:
                    current_chunk = []
                    current_length = 0
            
            current_chunk.append(sentence)
            current_length += sentence_length
        
        # Add remaining chunk
        if current_chunk:
            chunk_text = '. '.join(current_chunk) + '.'
            chunks.append({
                'text': chunk_text,
                'length': len(chunk_text)
            })
        
        print(f"📄 Created {len(chunks)} chunks from text")
        return chunks
    
    def create_embeddings(self, texts: List[str]) -> np.ndarray:
        """
        Create embeddings for a list of texts
        """
        if not self.embeddings_available or not self.model:
            return None
        
        try:
            embeddings = self.model.encode(texts, convert_to_numpy=True)
            print(f"✅ Created embeddings with shape: {embeddings.shape}")
            return embeddings
        except Exception as e:
            print(f"❌ Error creating embeddings: {e}")
            return None
    
    def create_vector_store(self, document_id: str, chunks: List[Dict]) -> bool:
        """
        Create FAISS vector store for document chunks
        """
        if not self.embeddings_available:
            print("⚠️ Embeddings not available, skipping vector store creation")
            return False
        
        try:
            # Extract chunk texts
            chunk_texts = [chunk['text'] for chunk in chunks]
            
            # Create embeddings
            embeddings = self.create_embeddings(chunk_texts)
            if embeddings is None:
                return False
            
            # Create FAISS index
            dimension = embeddings.shape[1]
            index = faiss.IndexFlatL2(dimension)  # L2 distance
            index.add(embeddings)
            
            # Save index and chunks
            store_path = os.path.join(self.vector_store_dir, f"{document_id}.faiss")
            chunks_path = os.path.join(self.vector_store_dir, f"{document_id}_chunks.pkl")
            
            faiss.write_index(index, store_path)
            with open(chunks_path, 'wb') as f:
                pickle.dump(chunks, f)
            
            print(f"✅ Vector store created for document {document_id}")
            return True
            
        except Exception as e:
            print(f"❌ Error creating vector store: {e}")
            return False
    
    def search_similar_chunks(self, document_id: str, query: str, top_k: int = 5) -> List[Dict]:
        """
        Search for similar chunks using semantic similarity
        """
        if not self.embeddings_available:
            print("⚠️ Embeddings not available, returning empty results")
            return []
        
        try:
            # Load index and chunks
            store_path = os.path.join(self.vector_store_dir, f"{document_id}.faiss")
            chunks_path = os.path.join(self.vector_store_dir, f"{document_id}_chunks.pkl")
            
            if not os.path.exists(store_path) or not os.path.exists(chunks_path):
                print(f"⚠️ Vector store not found for document {document_id}")
                return []
            
            index = faiss.read_index(store_path)
            with open(chunks_path, 'rb') as f:
                chunks = pickle.load(f)
            
            # Create query embedding
            query_embedding = self.create_embeddings([query])
            if query_embedding is None:
                return []
            
            # Search
            distances, indices = index.search(query_embedding, min(top_k, len(chunks)))
            
            # Get results
            results = []
            for i, idx in enumerate(indices[0]):
                if idx < len(chunks):
                    results.append({
                        'text': chunks[idx]['text'],
                        'score': float(distances[0][i]),
                        'index': int(idx)
                    })
            
            print(f"🔍 Found {len(results)} similar chunks")
            return results
            
        except Exception as e:
            print(f"❌ Error searching chunks: {e}")
            return []
    
    def get_context_for_generation(self, document_id: str, query: str, max_chunks: int = 3) -> str:
        """
        Get relevant context for quiz/flashcard generation
        """
        chunks = self.search_similar_chunks(document_id, query, top_k=max_chunks)
        
        if not chunks:
            return ""
        
        # Combine chunks into context
        context = "\n\n".join([chunk['text'] for chunk in chunks])
        return context
    
    def process_document(self, document_id: str, text: str) -> Dict:
        """
        Process document: chunk and create vector store
        """
        if not text or len(text) < 50:
            return {'success': False, 'error': 'Text too short'}
        
        # Chunk text
        chunks = self.chunk_text(text)
        
        # Create vector store
        vector_store_created = self.create_vector_store(document_id, chunks)
        
        return {
            'success': True,
            'num_chunks': len(chunks),
            'vector_store_created': vector_store_created,
            'embeddings_available': self.embeddings_available
        }

# Global RAG service instance
rag_service = RAGService()
