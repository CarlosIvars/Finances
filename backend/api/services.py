import re
import pandas as pd
from datetime import datetime
from .models import Transaction, Account, ImportBatch, Category, ClassificationRule


def clean_description(text: str) -> str:
    """
    Remove sensitive data from transaction descriptions:
    - Card numbers like "TARJ. 5402XXXXXXXX8016"
    - Reference numbers
    - Other PII patterns
    """
    # Remove card patterns: "TARJ. XXXXXXXXXXXX1234" or similar
    text = re.sub(r'TARJ\.\s*\d{4}X+\d{4}', '', text)
    
    # Remove standalone masked card numbers
    text = re.sub(r'\b\d{4}X+\d{4}\b', '', text)
    
    # Remove reference patterns like "REF: 123456789"
    text = re.sub(r'REF[:\s]*\d+', '', text)
    
    # Clean up extra spaces
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text


def extract_keywords(description: str) -> list:
    """
    Extract potential keywords from a description for learning.
    Focuses on meaningful words (brands, establishments).
    """
    # Common words to ignore
    stopwords = {
        'COMPRA', 'PAGO', 'ADEUDO', 'RECIBO', 'TARJ', 'TRANSFER', 
        'VISA', 'MASTERCARD', 'DEBITO', 'CREDITO', 'EUR', 'EUROS',
        'MADRID', 'BARCELONA', 'SPAIN', 'ESPAÑA', 'SA', 'SL', 'SLU'
    }
    
    # Extract words (alphanumeric, min 3 chars)
    words = re.findall(r'\b[A-Z]{3,}\b', description.upper())
    
    # Filter stopwords and return unique
    return list(set([w for w in words if w not in stopwords]))


def find_category_by_learning(user, description: str, rules) -> Category:
    """
    Smart categorization:
    1. First check explicit rules
    2. Then check if similar transactions were manually categorized
    """
    description_upper = description.upper()
    
    # 1. Check explicit rules
    for rule in rules:
        if rule.keyword.upper() in description_upper:
            return rule.category
    
    # 2. Learning from past categorizations
    # Find transactions with similar keywords that have been categorized
    keywords = extract_keywords(description)
    
    for keyword in keywords:
        # Find a categorized transaction with this keyword
        similar = Transaction.objects.filter(
            user=user,
            description__icontains=keyword,
            category__isnull=False,
            is_pending=False
        ).first()
        
        if similar:
            # Create a new rule for future use (learning)
            ClassificationRule.objects.get_or_create(
                user=user,
                keyword=keyword,
                defaults={'category': similar.category}
            )
            return similar.category
    
    return None


def process_import(import_batch_id):
    """
    Process an uploaded Excel file:
    1. Parse and normalize columns
    2. Clean sensitive data
    3. Smart categorization with learning
    4. Deduplication
    """
    batch = ImportBatch.objects.get(id=import_batch_id)
    file_path = batch.file.path
    
    try:
        # Determine engine
        engine = 'xlrd' if file_path.endswith('.xls') else 'openpyxl'

        # 1. Find Header
        df_raw = pd.read_excel(file_path, engine=engine, header=None)
        
        header_row = 0
        items_to_find = ["FECHA", "CONCEPTO", "IMPORTE", "SALDO", "DATE", "AMOUNT"]
        
        for idx, row in df_raw.iterrows():
            row_str = " ".join([str(x).upper() for x in row.values])
            if any(item in row_str for item in items_to_find):
                header_row = idx
                break
        
        # 2. Read Data
        df = pd.read_excel(file_path, engine=engine, header=header_row)
        
        # 3. Normalize Columns
        col_map = {}
        for col in df.columns:
            c_upper = str(col).upper()
            if "date" not in col_map.values() and any(x in c_upper for x in ["FECHA", "DATE", "F. OPERA", "F. VALOR"]):
                col_map[col] = "date"
            elif "description" not in col_map.values() and any(x in c_upper for x in ["CONCEPTO", "DESCRIPTION"]):
                col_map[col] = "description"
            elif "amount" not in col_map.values() and any(x in c_upper for x in ["IMPORTE", "AMOUNT"]):
                col_map[col] = "amount"
                
        df = df.rename(columns=col_map)
        
        if "date" not in df.columns or "amount" not in df.columns:
            raise ValueError(f"Could not identify critical columns. Found: {df.columns.tolist()}")

        # 4. Prepare for processing
        created_count = 0
        account, _ = Account.objects.get_or_create(
            user=batch.user, 
            name="Main Account", 
            defaults={'initial_balance': 0}
        )
        
        # Pre-load rules for efficiency
        rules = list(ClassificationRule.objects.filter(user=batch.user).select_related('category'))

        for _, row in df.iterrows():
            if pd.isna(row['date']) or pd.isna(row['amount']):
                continue
                
            # Date Parsing
            raw_date = row['date']
            if isinstance(raw_date, str):
                try:
                    date_obj = datetime.strptime(raw_date, "%d/%m/%Y").date()
                except:
                    date_obj = pd.to_datetime(raw_date).date()
            else:
                date_obj = raw_date.date() if hasattr(raw_date, 'date') else raw_date

            # Amount
            amount = row['amount']
            
            # Clean description (remove sensitive data)
            raw_description = str(row.get('description', 'Sin concepto'))
            clean_desc = clean_description(raw_description)
            
            # Determine type
            t_type = 'income' if amount > 0 else 'expense'

            # Deduplication (using cleaned description)
            if Transaction.objects.filter(
                user=batch.user, 
                date=date_obj, 
                amount=amount, 
                description=clean_desc
            ).exists():
                continue

            # Smart categorization with learning
            category = find_category_by_learning(batch.user, clean_desc, rules)
            
            # Refresh rules if a new one was created by learning
            if category and not any(r.category == category for r in rules):
                rules = list(ClassificationRule.objects.filter(user=batch.user).select_related('category'))

            Transaction.objects.create(
                user=batch.user,
                account=account,
                date=date_obj,
                description=clean_desc,
                amount=amount,
                type=t_type,
                raw_data=raw_description,  # Keep original for reference
                import_batch=batch,
                category=category,
                is_pending=category is None
            )
            created_count += 1
            
        batch.status = 'processed'
        batch.save()
        return created_count

    except Exception as e:
        batch.status = 'error'
        batch.save()
        raise e


def learn_from_categorization(transaction_id: int):
    """
    Called when a user manually categorizes a transaction.
    Creates rules based on keywords in the description.
    
    IMPORTANT: Only creates rules for FUTURE transactions.
    Never modifies already-categorized transactions (those are validated by user).
    """
    try:
        tx = Transaction.objects.get(id=transaction_id)
        if not tx.category:
            return 0
        
        keywords = extract_keywords(tx.description)
        
        # Create rules for the most significant keywords (max 2)
        rules_created = 0
        for keyword in keywords[:2]:
            _, created = ClassificationRule.objects.get_or_create(
                user=tx.user,
                keyword=keyword,
                defaults={'category': tx.category}
            )
            if created:
                rules_created += 1
        
        # DO NOT update old transactions - they are already validated by user
        # Rules will only apply to NEW imports
        
        return rules_created
    except Transaction.DoesNotExist:
        return 0
