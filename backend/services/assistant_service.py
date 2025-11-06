# backend/services/assistant_service.py
"""
AI Study Assistant Service
Provides RAG-powered chat, explanations, summaries, and study plans
"""

import openai
from openai import OpenAI
import os
from typing import List, Dict
from .rag_service import RAGService

# Initialize OpenAI client only if API key is available
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
client = None
if OPENAI_API_KEY:
    try:
        client = OpenAI(api_key=OPENAI_API_KEY)
        print("✅ OpenAI client initialized successfully")
    except Exception as e:
        print(f"⚠️ OpenAI initialization failed: {e}")
        client = None
else:
    print("⚠️ OPENAI_API_KEY not set - AI Assistant will use fallback responses")

class AssistantService:
    """AI Study Assistant with multiple capabilities"""
    
    def __init__(self):
        self.rag_service = RAGService()
        self.model = "gpt-4o-mini"
    
    def _check_openai_available(self):
        """Check if OpenAI client is available"""
        return client is not None
    
    def chat_with_document(self, document_text: str, question: str, document_id: str, chat_history: List[Dict] = None) -> Dict:
        """
        Chat with document using RAG
        Returns: {answer, relevant_chunks, sources}
        """
        try:
            # Check if OpenAI client is available
            if not self._check_openai_available():
                return {
                    'answer': "AI Assistant is currently unavailable. Please set OPENAI_API_KEY environment variable to enable AI features.",
                    'relevant_chunks': [],
                    'sources': [],
                    'confidence': 'low',
                    'error': 'OpenAI API key not configured'
                }
            
            # Get relevant context from document using RAG
            relevant_chunks = self.rag_service.retrieve_relevant_context(
                document_text, 
                question, 
                document_id,
                top_k=3
            )
            
            # Build context from chunks
            context = "\n\n".join([chunk['text'] for chunk in relevant_chunks])
            
            # Build chat history context
            history_context = ""
            if chat_history:
                last_messages = chat_history[-5:]  # Last 5 messages for context
                for msg in last_messages:
                    role = msg['role'].capitalize()
                    history_context += f"{role}: {msg['content']}\n"
            
            # Create prompt
            system_prompt = """You are an intelligent study assistant. Your role is to help students understand their study materials better.

Guidelines:
- Provide clear, accurate answers based on the document content
- If the question cannot be answered from the document, say so politely
- Break down complex concepts into simple explanations
- Use examples when helpful
- Be encouraging and supportive
- Keep answers concise but complete (2-4 sentences typically)"""

            user_prompt = f"""Document Context:
{context}

Previous Conversation:
{history_context}

Student Question: {question}

Please provide a helpful answer based on the document content."""

            # Call OpenAI
            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
                max_tokens=500
            )
            
            answer = response.choices[0].message.content
            
            return {
                'answer': answer,
                'relevant_chunks': relevant_chunks,
                'sources': [chunk.get('page', 'N/A') for chunk in relevant_chunks],
                'confidence': 'high' if len(relevant_chunks) >= 2 else 'medium'
            }
            
        except Exception as e:
            print(f"❌ Chat error: {e}")
            return {
                'answer': "I'm sorry, I encountered an error while processing your question. Please try again.",
                'relevant_chunks': [],
                'sources': [],
                'confidence': 'low',
                'error': str(e)
            }
    
    def explain_concept(self, document_text: str, concept: str, document_id: str) -> Dict:
        """
        Explain a specific concept from the document
        Returns: {explanation, examples, related_concepts}
        """
        try:
            # Get context about the concept
            relevant_chunks = self.rag_service.retrieve_relevant_context(
                document_text, 
                f"Explain {concept} in detail with examples", 
                document_id,
                top_k=4
            )
            
            context = "\n\n".join([chunk['text'] for chunk in relevant_chunks])
            
            prompt = f"""Based on this document content:

{context}

Please explain the concept of "{concept}" in a way that's easy for students to understand.

Provide:
1. Simple Definition (1-2 sentences)
2. Detailed Explanation (2-3 sentences)
3. Real-world Example or Analogy
4. Key Points to Remember (bullet points)

Format your response clearly with these sections."""

            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert teacher who explains concepts clearly and memorably."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=600
            )
            
            explanation = response.choices[0].message.content
            
            # Extract related concepts from the chunks
            related_concepts = self._extract_key_terms(context)
            
            return {
                'concept': concept,
                'explanation': explanation,
                'related_concepts': related_concepts[:5],
                'sources': [chunk.get('page', 'N/A') for chunk in relevant_chunks]
            }
            
        except Exception as e:
            print(f"❌ Explain concept error: {e}")
            return {
                'concept': concept,
                'explanation': f"I couldn't find enough information about '{concept}' in this document.",
                'related_concepts': [],
                'sources': [],
                'error': str(e)
            }
    
    def generate_practice_problems(self, document_text: str, topic: str, document_id: str, num_problems: int = 5) -> Dict:
        """
        Generate practice problems based on document content
        Returns: {problems: [{question, hint, answer}]}
        """
        try:
            # Get relevant content
            relevant_chunks = self.rag_service.retrieve_relevant_context(
                document_text, 
                f"Practice problems and exercises about {topic}", 
                document_id,
                top_k=5
            )
            
            context = "\n\n".join([chunk['text'] for chunk in relevant_chunks])
            
            prompt = f"""Based on this study material:

{context}

Generate {num_problems} practice problems about "{topic}".

For EACH problem, provide:
1. Question - Clear, specific, tests understanding
2. Hint - One helpful hint (don't give away the answer)
3. Answer - Detailed answer with explanation

Format as:
**Problem 1:**
Question: [question here]
Hint: [hint here]
Answer: [answer here]

Make problems progressively challenging (easy → medium → hard)."""

            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a teacher creating practice problems to test student understanding."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.8,
                max_tokens=1000
            )
            
            problems_text = response.choices[0].message.content
            
            # Parse problems (simple parsing)
            problems = self._parse_problems(problems_text)
            
            return {
                'topic': topic,
                'problems': problems,
                'total': len(problems)
            }
            
        except Exception as e:
            print(f"❌ Generate practice problems error: {e}")
            return {
                'topic': topic,
                'problems': [],
                'total': 0,
                'error': str(e)
            }
    
    def summarize_document(self, document_text: str, summary_type: str = "brief") -> Dict:
        """
        Summarize document
        summary_type: "brief" (3-5 sentences) or "detailed" (paragraph)
        Returns: {summary, key_points, word_count}
        """
        try:
            # For long documents, use chunks
            if len(document_text) > 4000:
                document_text = document_text[:4000] + "..."
            
            if summary_type == "brief":
                max_tokens = 200
                instruction = "Provide a brief 3-5 sentence summary of the main ideas."
            else:
                max_tokens = 500
                instruction = "Provide a detailed paragraph summary covering all major topics and key points."
            
            prompt = f"""Document:

{document_text}

{instruction}"""

            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert at creating clear, accurate summaries."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.5,
                max_tokens=max_tokens
            )
            
            summary = response.choices[0].message.content
            
            # Extract key points
            key_points = self._extract_key_points(document_text)
            
            return {
                'summary': summary,
                'key_points': key_points,
                'word_count': len(document_text.split()),
                'summary_type': summary_type
            }
            
        except Exception as e:
            print(f"❌ Summarize error: {e}")
            return {
                'summary': "Unable to generate summary at this time.",
                'key_points': [],
                'word_count': 0,
                'error': str(e)
            }
    
    def create_study_plan(self, weak_areas: List[str], document_text: str, document_id: str, days: int = 7) -> Dict:
        """
        Create personalized study plan focusing on weak areas
        Returns: {plan: [{day, topic, activities}], tips}
        """
        try:
            weak_areas_text = ", ".join(weak_areas) if weak_areas else "general review"
            
            # Get context for weak areas
            context_chunks = []
            for area in weak_areas[:3]:  # Top 3 weak areas
                chunks = self.rag_service.retrieve_relevant_context(
                    document_text, 
                    area, 
                    document_id,
                    top_k=2
                )
                context_chunks.extend(chunks)
            
            context = "\n\n".join([chunk['text'] for chunk in context_chunks[:5]])
            
            prompt = f"""Create a {days}-day study plan to help a student improve in these weak areas:
{weak_areas_text}

Document content:
{context}

For each day, provide:
- Day number
- Topic/Focus area
- 2-3 specific study activities (15-30 min each)
- Success criteria (how to know you've mastered it)

Format as:
**Day 1: [Topic]**
- Activity 1: [description]
- Activity 2: [description]
- Success: [criteria]

Make the plan progressive (easier → harder) and realistic."""

            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a study coach creating personalized learning plans."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=800
            )
            
            plan_text = response.choices[0].message.content
            
            # Parse study plan
            plan_days = self._parse_study_plan(plan_text, days)
            
            return {
                'plan': plan_days,
                'weak_areas': weak_areas,
                'duration_days': days,
                'tips': [
                    "Study at the same time each day for consistency",
                    "Take 5-min breaks between activities",
                    "Test yourself regularly to track progress",
                    "Focus on understanding, not memorization"
                ]
            }
            
        except Exception as e:
            print(f"❌ Create study plan error: {e}")
            return {
                'plan': [],
                'weak_areas': weak_areas,
                'duration_days': days,
                'tips': [],
                'error': str(e)
            }
    
    # Helper methods
    
    def _extract_key_terms(self, text: str, max_terms: int = 10) -> List[str]:
        """Extract key terms from text (simple implementation)"""
        # This is a simple implementation - could be enhanced with NLP
        words = text.split()
        # Filter capitalized words and longer words (likely important terms)
        key_terms = [w.strip('.,!?;:') for w in words if len(w) > 6 and (w[0].isupper() or w.isupper())]
        # Remove duplicates while preserving order
        seen = set()
        unique_terms = []
        for term in key_terms:
            if term.lower() not in seen:
                seen.add(term.lower())
                unique_terms.append(term)
        return unique_terms[:max_terms]
    
    def _extract_key_points(self, text: str, max_points: int = 5) -> List[str]:
        """Extract key points from text"""
        # Split by sentences (simple implementation)
        sentences = text.split('. ')
        # Return first few sentences as key points
        key_points = [s.strip() + '.' for s in sentences[:max_points] if len(s) > 20]
        return key_points
    
    def _parse_problems(self, problems_text: str) -> List[Dict]:
        """Parse generated problems into structured format"""
        problems = []
        lines = problems_text.split('\n')
        
        current_problem = {}
        for line in lines:
            line = line.strip()
            if line.startswith('**Problem') or line.startswith('Problem'):
                if current_problem:
                    problems.append(current_problem)
                current_problem = {}
            elif line.startswith('Question:'):
                current_problem['question'] = line.replace('Question:', '').strip()
            elif line.startswith('Hint:'):
                current_problem['hint'] = line.replace('Hint:', '').strip()
            elif line.startswith('Answer:'):
                current_problem['answer'] = line.replace('Answer:', '').strip()
        
        if current_problem:
            problems.append(current_problem)
        
        return problems
    
    def _parse_study_plan(self, plan_text: str, days: int) -> List[Dict]:
        """Parse study plan into structured format"""
        plan_days = []
        lines = plan_text.split('\n')
        
        current_day = {}
        for line in lines:
            line = line.strip()
            if line.startswith('**Day') or line.startswith('Day'):
                if current_day:
                    plan_days.append(current_day)
                # Extract day number and topic
                parts = line.replace('**', '').replace('Day', '').split(':', 1)
                current_day = {
                    'day': int(parts[0].strip()) if parts[0].strip().isdigit() else len(plan_days) + 1,
                    'topic': parts[1].strip() if len(parts) > 1 else 'Study Session',
                    'activities': []
                }
            elif line.startswith('-') or line.startswith('•'):
                activity = line.lstrip('-•').strip()
                if activity and current_day:
                    current_day['activities'].append(activity)
        
        if current_day:
            plan_days.append(current_day)
        
        return plan_days
