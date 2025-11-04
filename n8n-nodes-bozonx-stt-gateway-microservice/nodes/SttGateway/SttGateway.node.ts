import {
	NodeOperationError,
	type IExecuteFunctions,
	type IDataObject,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type IHttpRequestOptions,
} from 'n8n-workflow';

export class SttGateway implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'STT Gateway',
		name: 'bozonxSttGateway',
		group: ['output'],
		version: 1,
		description: 'Synchronous transcription via STT Gateway microservice',
		defaults: { name: 'STT Gateway' },
		icon: 'file:stt-gateway.svg',
		documentationUrl: 'https://github.com/bozonx/stt-gateway-microservice/tree/main/n8n-nodes-bozonx-stt-gateway-microservice#readme',
		usableAsTool: true,
		inputs: ['main'],
		outputs: ['main'],
		requestDefaults: {
			baseURL: '={{$credentials.gatewayUrl}}',
			headers: {
				Accept: 'application/json',
			},
		},
		credentials: [
			{
				name: 'bozonxMicroservicesApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Base Path',
				name: 'basePath',
				type: 'string',
				default: 'stt/api/v1',
				description: 'API base path appended to the Gateway URL (leading/trailing slashes are ignored)',
			},
			{
				displayName: 'Audio URL',
				name: 'audioUrl',
				type: 'string',
				default: '',
				required: true,
				description: 'Public HTTPS URL to the audio file',
			},
			{
				displayName: 'Provider',
				name: 'provider',
				type: 'options',
				options: [
					{ name: 'AssemblyAI', value: 'assemblyai' },
				],
				default: '',
				required: false,
				description: 'Speech-to-text provider',
			},
			{
				displayName: 'Timestamps',
				name: 'timestamps',
				type: 'boolean',
				default: false,
				description: 'Include word-level timestamps in provider request (if supported)',
			},
			{
				displayName: 'Restore Punctuation',
				name: 'restorePunctuation',
				type: 'boolean',
				default: true,
				description: 'Request provider to restore punctuation (default true when supported)',
			},
			{
				displayName: 'Provider API Key',
				name: 'apiKey',
				type: 'string',
				default: '',
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
				const timestamps = this.getNodeParameter('timestamps', i) as boolean;
				const restorePunctuation = this.getNodeParameter('restorePunctuation', i) as boolean;
				const apiKey = this.getNodeParameter('apiKey', i) as string;
				const basePathParam = (this.getNodeParameter('basePath', i) as string) || '';
				const normalizedBasePath = basePathParam.replace(/^\/+|\/+$/g, '');
				const pathPrefix = normalizedBasePath ? `${normalizedBasePath}/` : '';

				if (!audioUrl) {
					throw new NodeOperationError(this.getNode(), 'Audio URL is required', { itemIndex: i });
				}

				const creds = await this.getCredentials('bozonxMicroservicesApi');
				let baseURL = ((creds?.gatewayUrl as string) || '').trim();
				if (!baseURL) {
					throw new NodeOperationError(this.getNode(), 'Gateway URL is required in credentials', { itemIndex: i });
				}
				if (!/^https?:\/\//i.test(baseURL)) {
					throw new NodeOperationError(this.getNode(), 'Gateway URL must include protocol (http:// or https://)', { itemIndex: i });
				}
				baseURL = baseURL.replace(/\/+$/g, '');

				const options: IHttpRequestOptions = {
					method: 'POST',
					url: `${pathPrefix}transcriptions/file`,
					json: true,
					body: (() => {
						const body: IDataObject = {
							audioUrl,
							timestamps,
							restorePunctuation,
						};
						if (provider) {
							body.provider = provider;
						}
						return body;
					})(),
				};
				(options as unknown as { baseURL?: string }).baseURL = baseURL;

				if (apiKey) {
					(options.body as IDataObject).apiKey = apiKey;
				}

				const response = await this.helpers.httpRequestWithAuthentication.call(this, 'bozonxMicroservicesApi', options);
				returnData.push({ json: response as IDataObject, pairedItem: { item: i } });
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message } as IDataObject, pairedItem: { item: i } });
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
