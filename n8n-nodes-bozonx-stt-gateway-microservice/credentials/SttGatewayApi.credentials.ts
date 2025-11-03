import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class SttGatewayApi implements ICredentialType {
	name = 'sttGatewayApi';
	displayName = 'STT Gateway API';
	documentationUrl = 'https://github.com/bozonx/stt-gateway-microservice/tree/main/n8n-nodes-bozonx-stt-gateway-microservice#readme';
	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: '',
			placeholder: 'https://stt-gateway.example.com',
			required: true,
			description: 'Base URL of the STT Gateway (without /api/v1)',
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
			description: 'Username for Basic authentication (optional)',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'Password for Basic authentication (optional)',
		},
	];

	authenticate: ICredentialType['authenticate'] = {
		type: 'generic',
		properties: {
			auth: {
				username: '={{$credentials.username}}',
				password: '={{$credentials.password}}',
			},
		},
	};
}
