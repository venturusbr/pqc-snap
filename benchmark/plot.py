import pandas as pd
import json
import matplotlib.pyplot as plt
import seaborn as sns


with open('/content/timeseries_data.json', 'r') as f:
    data = json.load(f)
df_ts = pd.DataFrame(data)


def plot_comparison(df, col_ecdsa, col_hybrid, title, ylabel, x_label):
    plt.figure(figsize=(10, 5))
    x_axis = df['iteration'] if 'iteration' in df.columns else df.index
    sns.lineplot(x=x_axis, y=df[col_ecdsa], label='ECDSA', linewidth=1.2)
    sns.lineplot(x=x_axis, y=df[col_hybrid], label='Hybrid', linewidth=1.2)
    plt.title(title, fontsize=16, fontweight='bold')
    plt.xlabel(x_label,fontsize=14)
    plt.ylabel(ylabel, fontsize=14)
    plt.legend()
    plt.tight_layout()
    plt.grid(True)
    plt.savefig(f"{title}.eps", format="eps")
    plt.show()

plot_comparison(df_ts, 'keyGenEcdsaMs', 'keyGenHybridMs', 'KeyGen: Execution Time', 'Time (ms)', 'Keys')
plot_comparison(df_ts, 'keyGenEcdsaRamKb', 'keyGenHybridRamKb', 'KeyGen: RAM Usage', 'RAM (KB)', 'Keys')
plot_comparison(df_ts, 'signEcdsaMs', 'signHybridMs', 'Signing: Execution Time', 'Time (ms)', 'Signatures')
plot_comparison(df_ts, 'signEcdsaRamKb', 'signHybridRamKb', 'Signing: RAM Usage', 'RAM (KB)', 'Signatures')
plot_comparison(df_ts, 'verifyEcdsaMs', 'verifyHybridMs', 'Verification: Execution Time', 'Time (ms)', 'Verifications')
plot_comparison(df_ts, 'verifyEcdsaRamKb', 'verifyHybridRamKb', 'Verification: RAM Usage', 'RAM (KB)', 'Verifications')

# e2e tests

def load_transaction_data(file_path, label):
    with open(file_path, 'r') as f:
        data = json.load(f)
    # Assuming the structure has a 'transactions' key containing a list of objects
    df = pd.DataFrame(data['transactions'])
    df['label'] = label
    return df

try:
    df_ecdsa = load_transaction_data('besu_ecdsa_results.json', 'ECDSA')
    df_hybrid = load_transaction_data('besu_hybrid_resultsjson', 'Hybrid')

    df_combined = pd.concat([df_ecdsa, df_hybrid], ignore_index=True)

    # Add an index for the transaction sequence within each group
    df_combined['tx_index'] = df_combined.groupby('label').cumcount()

    # 1. Line Plot: Temporal trend of totalE2EMs
    plt.figure(figsize=(12, 6))
    sns.lineplot(data=df_combined, x='tx_index', y='totalE2EMs', hue='label', marker='o')
    plt.title('Comparison of Total End-to-End Latency', fontsize=16, fontweight='bold')
    plt.xlabel('Transactions', fontsize=14)
    plt.ylabel('Latency (ms)', fontsize=14)
    plt.legend(title='Algorithm')
    plt.grid(True, linestyle='--', alpha=0.6)
    plt.savefig(f"e2e.eps", format="eps")
    plt.show()

    # Display summary statistics
    #summary = df_combined.groupby('label')['totalE2EMs'].describe()
    #print("Summary Statistics for totalE2EMs:")
    #display(summary)

except Exception as e:
    print(f"Error processing files: {e}")