from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('api', '0008_transaction_metadata')]

    operations = [
        migrations.AddField(
            model_name='category',
            name='icon',
            field=models.CharField(default='credit_card', max_length=40),
        ),
    ]
