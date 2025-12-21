import {
	NodeOperationError,
	type IExecuteFunctions,
	type IDataObject,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type IHttpRequestOptions,
} from 'n8n-workflow';

export class BozonxSttGateway implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'STT Gateway',
		name: 'bozonxSttGateway',
		group: ['output'],
		version: 1,
		description: 'Synchronous transcription via STT Gateway microservice',
		defaults: { name: 'STT Gateway' },
		icon: 'file:stt-gateway.svg',
		documentationUrl:
			'https://github.com/bozonx/stt-gateway-microservice/tree/main/n8n-nodes-bozonx-stt-gateway-microservice#readme',
		usableAsTool: true,
		inputs: ['main'],
		outputs: ['main'],
		requestDefaults: {
			headers: {
				Accept: 'application/json',
			},
		},
		credentials: [
			{
				name: 'sttGatewayApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Audio URL',
				name: 'audioUrl',
				type: 'string',
				default: '',
				required: true,
				description: 'Public HTTP(S) URL to the audio file',
			},
			{
				displayName: 'Provider',
				name: 'provider',
				type: 'options',
				options: [
					{ name: '(Use Service Default)', value: '' },
					{ name: 'AssemblyAI', value: 'assemblyai' },
				],
				default: '',
				description: 'Speech-to-text provider',
			},
			{
				displayName: 'Language',
				name: 'language',
				type: 'string',
				default: '',
				description:
					"Explicit language code for the audio (e.g., 'en', 'ru', 'en-US'). Leave empty for auto-detect when supported.",
			},
			{
				displayName: 'Restore Punctuation',
				name: 'restorePunctuation',
				type: 'boolean',
				default: true,
				description:
					'Whether to request the provider to restore punctuation (default true when supported)',
			},
			{
				displayName: 'Format Text',
				name: 'formatText',
				type: 'boolean',
				default: true,
				description: 'Whether to format text output (punctuation, capitalization)',
			},
			{
				displayName: 'Provider API Key',
				name: 'apiKey',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				displayOptions: {
					show: {
						provider: ['assemblyai'],
					},
				},
				description: 'Optional direct provider API key (when allowed by service policy)',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const audioUrl = this.getNodeParameter('audioUrl', i) as string;
				const provider = this.getNodeParameter('provider', i, '') as string;
				const restorePunctuation = this.getNodeParameter('restorePunctuation', i) as boolean;
				const language = (this.getNodeParameter('language', i, '') as string).trim();
				const formatText = this.getNodeParameter('formatText', i) as boolean;
				const apiKey = provider ? (this.getNodeParameter('apiKey', i) as string) : '';

				if (!audioUrl) {
					throw new NodeOperationError(this.getNode(), 'Audio URL is required', { itemIndex: i });
				}

				const creds = await this.getCredentials('sttGatewayApi');
				let baseURL = ((creds?.baseUrl as string) || '').trim();
				if (!baseURL) {
					throw new NodeOperationError(this.getNode(), 'Base URL is required in credentials', {
						itemIndex: i,
					});
				}
				if (!/^https?:\/\//i.test(baseURL)) {
					throw new NodeOperationError(
						this.getNode(),
						'Base URL must include protocol (http:// or https://)',
						{ itemIndex: i },
					);
				}
				baseURL = baseURL.replace(/\/+$/g, '');

				const options: IHttpRequestOptions = {
					method: 'POST',
					url: `${baseURL}/api/v1/transcribe`,
					json: true,
					body: (() => {
						const body: IDataObject = { audioUrl };
						if (provider) body.provider = provider;
						if (restorePunctuation === false) body.restorePunctuation = false;
						if (language) body.language = language;
						if (formatText === false) body.formatText = false;
						if (apiKey) body.apiKey = apiKey;
						return body;
					})(),
				};

				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'sttGatewayApi',
					options,
				);
				returnData.push({ json: response as IDataObject, pairedItem: { item: i } });
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message } as IDataObject,
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
